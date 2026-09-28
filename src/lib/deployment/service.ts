import "server-only";
import { integrations, serverConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertGithubConfigured, getUserGithubToken } from "@/lib/github/client";
import { downloadTarball, getLatestCommit } from "@/lib/github/repos";
import { assertVercelConfigured, toPublicVercelError } from "@/lib/vercel/client";
import { createVercelProject, upsertVercelEnv } from "@/lib/vercel/projects";
import {
  createVercelDeployment,
  eventText,
  getVercelDeployment,
  getVercelDeploymentEvents,
  mapReadyState,
  uploadFile,
} from "@/lib/vercel/deployments";
import type { VercelEnvTarget, VercelFileRef } from "@/lib/vercel/types";
import { getFramework } from "@/lib/frameworks";
import { assertWithinLimit, incrementUsage } from "@/lib/data/limits";
import { getPlatformSettings } from "@/lib/data/settings";
import { createNotification } from "@/lib/data/notifications";
import { appendLog } from "@/lib/deployment/logs";
import { extractTarGz } from "@/lib/deployment/tar";
import { decryptSecret, sha1Hex } from "@/lib/utils/crypto";
import { PublicError, sanitizeLogLine } from "@/lib/utils/sanitize";
import { ensureUrl, slugify } from "@/lib/utils";
import type { Deployment, DeploymentLog, DeploymentStatus, Project } from "@/types/database";

const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 8;
const TERMINAL: DeploymentStatus[] = ["ready", "error", "cancelled"];

export function isTerminal(status: DeploymentStatus): boolean {
  return TERMINAL.includes(status);
}

async function loadProjectForUser(userId: string, projectId: string): Promise<Project> {
  const { data } = await createAdminClient()
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new PublicError("Project not found", 404);
  return data as Project;
}

async function getProjectSecrets(projectId: string): Promise<{ key: string; value: string; targets: string[]; id: string }[]> {
  const { data } = await createAdminClient()
    .from("environment_variables")
    .select("id, key, value_encrypted, targets")
    .eq("project_id", projectId);
  return ((data as { id: string; key: string; value_encrypted: string; targets: string[] }[]) ?? []).map((row) => ({
    id: row.id,
    key: row.key,
    value: decryptSecret(row.value_encrypted),
    targets: row.targets,
  }));
}

function providerSettings(project: Project) {
  const preset = getFramework(project.framework);
  return {
    framework: preset.providerSlug,
    buildCommand: project.build_command || null,
    installCommand: project.install_command || null,
    outputDirectory: project.output_directory || null,
    rootDirectory: project.root_directory || null,
  };
}

/** Creates the provider-side project on first deploy and syncs env vars. */
async function ensureProviderProject(project: Project, deploymentId: string): Promise<string> {
  const admin = createAdminClient();
  let providerId = project.provider_project_id;

  if (!providerId) {
    const name = slugify(`${serverConfig.vercelProjectPrefix()}-${project.slug}`, 90);
    await appendLog(deploymentId, `Creating infrastructure project "${name}"`);
    const created = await createVercelProject(name, providerSettings(project));
    providerId = created.id;
    await admin.from("projects").update({ provider_project_id: providerId }).eq("id", project.id);
  }

  const envVars = await getProjectSecrets(project.id);
  if (envVars.length > 0) {
    await appendLog(deploymentId, `Syncing ${envVars.length} environment variable(s)`);
    for (const env of envVars) {
      const { id } = await upsertVercelEnv(providerId, env.key, env.value, env.targets as VercelEnvTarget[]);
      if (id) await admin.from("environment_variables").update({ provider_env_id: id }).eq("id", env.id);
    }
  }
  return providerId;
}

/**
 * Validates and records a new deployment. The heavy lifting (archive download,
 * upload, provider deployment) runs in `runDeployment`, scheduled via `after()`.
 */
export async function queueDeployment(userId: string, projectId: string): Promise<Deployment> {
  assertVercelConfigured();
  assertGithubConfigured();

  const settings = await getPlatformSettings();
  if (!settings.deployments_enabled || settings.maintenance_mode) {
    throw new PublicError("Deployments are temporarily disabled by the platform administrator.", 503);
  }

  const project = await loadProjectForUser(userId, projectId);
  const admin = createAdminClient();

  const { data: active } = await admin
    .from("deployments")
    .select("id")
    .eq("project_id", project.id)
    .in("status", ["queued", "building"])
    .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .limit(1);
  if (active && active.length > 0) {
    throw new PublicError("A deployment is already in progress for this project.", 409);
  }

  await assertWithinLimit(userId, "deployments");

  const { data, error } = await admin
    .from("deployments")
    .insert({
      project_id: project.id,
      user_id: userId,
      status: "queued",
      branch: project.branch,
      provider: "vercel",
    })
    .select("*")
    .single();
  if (error || !data) throw new PublicError("Could not create deployment record.", 500);

  await admin
    .from("projects")
    .update({ latest_deployment_status: "queued", last_deployed_at: new Date().toISOString() })
    .eq("id", project.id);
  await incrementUsage(userId, "deployments_count");
  await incrementUsage(userId, "builds_count");
  await appendLog((data as Deployment).id, "Deployment queued");
  return data as Deployment;
}

async function markFailed(deployment: { id: string; project_id: string; user_id: string }, message: string, projectName: string) {
  const admin = createAdminClient();
  await admin.from("deployments").update({ status: "error", error_message: message }).eq("id", deployment.id);
  await admin.from("projects").update({ latest_deployment_status: "error" }).eq("id", deployment.project_id);
  await appendLog(deployment.id, message, "error");
  await createNotification(deployment.user_id, {
    type: "deployment_failed",
    title: `Deployment failed: ${projectName}`,
    body: message,
    link: `/dashboard/deployments/${deployment.id}`,
  });
}

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await fn(current);
    }
  });
  await Promise.all(workers);
}

/** Performs the actual deployment. Safe to run in the background. */
export async function runDeployment(deploymentId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: depRow } = await admin.from("deployments").select("*").eq("id", deploymentId).maybeSingle();
  if (!depRow) return;
  const deployment = depRow as Deployment;
  const { data: projRow } = await admin.from("projects").select("*").eq("id", deployment.project_id).maybeSingle();
  if (!projRow) return;
  const project = projRow as Project;

  try {
    const token = await getUserGithubToken(deployment.user_id);
    const ref = deployment.branch ?? project.branch;

    await appendLog(deploymentId, `Cloning github.com/${project.repo_owner}/${project.repo_name} (branch: ${ref})`, "command");
    const commit = await getLatestCommit(token, project.repo_owner, project.repo_name, ref);
    await admin
      .from("deployments")
      .update({ commit_sha: commit.sha, commit_message: commit.message, commit_author: commit.author })
      .eq("id", deploymentId);
    await appendLog(deploymentId, `Commit ${commit.sha.slice(0, 7)}: ${commit.message}`);

    const archive = await downloadTarball(token, project.repo_owner, project.repo_name, commit.sha);
    const { files, skipped } = extractTarGz(archive);
    const totalBytes = files.reduce((sum, f) => sum + f.content.length, 0);
    const settings = await getPlatformSettings();

    if (files.length === 0) throw new PublicError("The repository archive contains no files.");
    if (files.length > settings.max_upload_files) {
      throw new PublicError(`Repository has ${files.length} files, above the ${settings.max_upload_files} file limit.`);
    }
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new PublicError("Repository source exceeds the 200 MB upload limit.");
    }
    await appendLog(
      deploymentId,
      `Prepared ${files.length} files (${(totalBytes / 1024 / 1024).toFixed(1)} MB)${skipped ? `, skipped ${skipped} symlink(s)` : ""}`,
      "success",
    );

    const providerProjectId = await ensureProviderProject(project, deploymentId);

    await appendLog(deploymentId, "Uploading source to build infrastructure");
    const refs: VercelFileRef[] = files.map((f) => ({ file: f.path, sha: sha1Hex(f.content), size: f.content.length }));
    const byPath = new Map(files.map((f) => [f.path, f.content]));
    await mapWithConcurrency(refs, UPLOAD_CONCURRENCY, async (ref) => {
      await uploadFile(byPath.get(ref.file)!, ref.sha);
    });
    await appendLog(deploymentId, "Upload complete", "success");

    const created = await createVercelDeployment({
      name: slugify(`${serverConfig.vercelProjectPrefix()}-${project.slug}`, 90),
      projectId: providerProjectId,
      files: refs,
      projectSettings: providerSettings(project),
      meta: {
        deployxDeploymentId: deploymentId,
        githubCommitSha: commit.sha,
        githubCommitRef: ref,
        githubCommitMessage: commit.message.slice(0, 200),
        githubCommitAuthorLogin: commit.author,
        githubRepo: project.repo_name,
        githubOrg: project.repo_owner,
      },
    });

    const status = mapReadyState(created.readyState);
    await admin
      .from("deployments")
      .update({
        provider_deployment_id: created.id,
        status,
        url: ensureUrl(created.url),
        inspector_url: created.inspectorUrl ?? null,
        build_started_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);
    await admin.from("projects").update({ latest_deployment_status: status }).eq("id", project.id);
    await appendLog(deploymentId, "Build started on infrastructure provider (Vercel)", "info");
  } catch (error) {
    const publicMessage =
      error instanceof PublicError ? error.message : toPublicVercelError(error, "Deployment failed").message;
    console.error("[deploy]", deploymentId, error);
    await markFailed(deployment, publicMessage, project.name);
  }
}

/** Pulls the latest provider state for a deployment and persists transitions. */
export async function syncDeployment(deployment: Deployment): Promise<Deployment> {
  if (!deployment.provider_deployment_id || isTerminal(deployment.status) || !integrations.vercel()) {
    return deployment;
  }
  const admin = createAdminClient();
  const remote = await getVercelDeployment(deployment.provider_deployment_id);
  const status = mapReadyState(remote.readyState);
  if (status === deployment.status) return deployment;

  const update: Partial<Deployment> = { status };
  if (remote.buildingAt) update.build_started_at = new Date(remote.buildingAt).toISOString();
  if (status === "ready") update.ready_at = new Date(remote.ready ?? Date.now()).toISOString();
  if (status === "error") update.error_message = remote.errorMessage ?? "Build failed. See logs for details.";

  const { data } = await admin.from("deployments").update(update).eq("id", deployment.id).select("*").single();
  const { data: project } = await admin.from("projects").select("*").eq("id", deployment.project_id).single();
  const proj = project as Project;

  if (status === "ready") {
    const { data: domain } = await admin
      .from("domains")
      .select("name")
      .eq("project_id", proj.id)
      .eq("status", "verified")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    const productionUrl = ensureUrl((domain as { name: string } | null)?.name ?? remote.alias?.[0] ?? remote.url);
    await admin
      .from("projects")
      .update({ latest_deployment_status: status, production_url: productionUrl })
      .eq("id", proj.id);
    await appendLog(deployment.id, "Deployment ready", "success");
    await createNotification(deployment.user_id, {
      type: "deployment_success",
      title: `${proj.name} is live`,
      body: productionUrl ?? undefined,
      link: `/dashboard/deployments/${deployment.id}`,
    });
  } else {
    await admin.from("projects").update({ latest_deployment_status: status }).eq("id", proj.id);
    if (status === "error" || status === "cancelled") {
      await appendLog(deployment.id, update.error_message ?? `Deployment ${status}`, "error");
      await createNotification(deployment.user_id, {
        type: "deployment_failed",
        title: `Deployment ${status === "error" ? "failed" : "cancelled"}: ${proj.name}`,
        body: update.error_message ?? undefined,
        link: `/dashboard/deployments/${deployment.id}`,
      });
    }
  }

  if (isTerminal(status)) await persistProviderLogs(deployment.id, deployment.provider_deployment_id, proj.id);
  return (data as Deployment) ?? deployment;
}

async function persistProviderLogs(deploymentId: string, providerId: string, projectId: string): Promise<void> {
  try {
    const events = await getVercelDeploymentEvents(providerId);
    const secrets = (await getProjectSecrets(projectId)).map((s) => s.value);
    const rows = events
      .map((event) => ({ event, text: eventText(event) }))
      .filter((e): e is { event: typeof e.event; text: string } => e.text !== null)
      .slice(-2000)
      .map(({ event, text }) => ({
        deployment_id: deploymentId,
        source: "provider",
        level: event.type === "stderr" || event.level === "error" ? "error" : event.type === "command" ? "command" : "info",
        message: sanitizeLogLine(text, secrets).slice(0, 4000),
        created_at: new Date(event.created || Date.now()).toISOString(),
      }));
    if (rows.length > 0) await createAdminClient().from("deployment_logs").insert(rows);
  } catch (error) {
    console.error("[deploy] failed to persist provider logs", error);
  }
}

export type LogLine = Pick<DeploymentLog, "source" | "level" | "message" | "created_at">;

/** Returns stored logs plus live provider logs while a build is in progress. */
export async function getDeploymentLogs(deployment: Deployment): Promise<LogLine[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("deployment_logs")
    .select("source, level, message, created_at")
    .eq("deployment_id", deployment.id)
    .order("id", { ascending: true })
    .limit(5000);
  const stored = (data as LogLine[]) ?? [];

  const hasProviderLogs = stored.some((l) => l.source === "provider");
  if (!deployment.provider_deployment_id || hasProviderLogs || !integrations.vercel()) return stored;

  try {
    const events = await getVercelDeploymentEvents(deployment.provider_deployment_id);
    const secrets = (await getProjectSecrets(deployment.project_id)).map((s) => s.value);
    const live: LogLine[] = events
      .map((event) => ({ event, text: eventText(event) }))
      .filter((e): e is { event: typeof e.event; text: string } => e.text !== null)
      .map(({ event, text }) => ({
        source: "provider",
        level: event.type === "stderr" ? "error" : event.type === "command" ? "command" : "info",
        message: sanitizeLogLine(text, secrets),
        created_at: new Date(event.created || Date.now()).toISOString(),
      }));
    return [...stored, ...live];
  } catch {
    return stored;
  }
}
