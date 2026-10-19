import { NextResponse, after } from "next/server";
import { withUser } from "@/lib/security/api";
import { createProjectSchema } from "@/lib/validation";
import { assertWithinLimit } from "@/lib/data/limits";
import { uniqueProjectSlug } from "@/lib/data/projects";
import { getUserGithubToken } from "@/lib/github/client";
import { getRepository } from "@/lib/github/repos";
import { generateWebhookSecret, getProjectWebhookSecret, getWebhookUrl, setupRepoWebhook } from "@/lib/github/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/utils/crypto";
import { PublicError } from "@/lib/utils/sanitize";
import { integrations } from "@/lib/env";
import { queueDeployment, runDeployment } from "@/lib/deployment/service";
import type { Project } from "@/types/database";

export const maxDuration = 300;

export const POST = withUser(
  { schema: createProjectSchema, rateLimit: { key: "project-create", limit: 10, windowMs: 60_000 } },
  async ({ user, body }) => {
    await assertWithinLimit(user.id, "projects");

    if (body.envVars.length > 0 && !integrations.encryption()) {
      throw new PublicError("ENCRYPTION_KEY is not configured, so environment variables can't be stored securely.", 503);
    }
    const keys = new Set<string>();
    for (const env of body.envVars) {
      if (keys.has(env.key)) throw new PublicError(`Duplicate environment variable: ${env.key}`, 422);
      keys.add(env.key);
    }

    // Confirms the user actually has access to the repository they're importing.
    const token = await getUserGithubToken(user.id);
    const repo = await getRepository(token, body.repoOwner, body.repoName);

    const generatedSecret = generateWebhookSecret();
    const admin = createAdminClient();
    const projectInsert: Record<string, unknown> = {
      user_id: user.id,
      name: body.name,
      slug: await uniqueProjectSlug(body.name),
      repo_owner: repo.owner,
      repo_name: repo.name,
      repo_id: repo.id,
      repo_private: repo.private,
      branch: body.branch,
      framework: body.framework,
      root_directory: body.rootDirectory,
      build_command: body.buildCommand,
      install_command: body.installCommand,
      output_directory: body.outputDirectory,
      auto_deploy: true,
      webhook_secret: generatedSecret,
    };

    let { data, error } = await admin.from("projects").insert(projectInsert).select("*").single();

    if (error && error.code === "42703") {
      // Fallback if migration 0003 has not yet been executed in Postgres
      delete projectInsert.auto_deploy;
      delete projectInsert.webhook_secret;
      const retry = await admin.from("projects").insert(projectInsert).select("*").single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) throw new PublicError("Could not create project.", 500);
    const project = data as Project;

    // Automatically attempt GitHub webhook registration in the background
    const webhookUrl = getWebhookUrl(project.id);
    const webhookSecret = getProjectWebhookSecret(project);
    after(() => {
      setupRepoWebhook(token, repo.owner, repo.name, webhookUrl, webhookSecret).catch((webhookErr) => {
        console.warn("[project create] Auto webhook setup skipped or requires manual install:", webhookErr);
      });
    });

    if (body.envVars.length > 0) {
      await admin.from("environment_variables").insert(
        body.envVars.map((env) => ({
          project_id: project.id,
          user_id: user.id,
          key: env.key,
          value_encrypted: encryptSecret(env.value),
        })),
      );
    }

    const sanitizedProject = { ...project, provider: "deployx" };

    if (!body.deploy) return NextResponse.json({ project: sanitizedProject });

    try {
      const deployment = await queueDeployment(user.id, project.id);
      after(() => runDeployment(deployment.id));
      const sanitizedDeployment = { ...deployment, provider: "deployx", inspector_url: null };
      return NextResponse.json({ project: sanitizedProject, deployment: sanitizedDeployment });
    } catch (err) {
      // The project exists; report why the deployment couldn't start.
      const message = err instanceof PublicError ? err.message : "Deployment could not be started.";
      return NextResponse.json({ project: sanitizedProject, deployError: message });
    }
  },
);
