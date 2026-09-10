import { nanoid } from "nanoid";
import { HOSTED_PROJECT_STATUSES } from "@/config/constants";
import { getAppUrl, getMainDomain, readEnv } from "@/lib/env.server";
import { assertSubscriptionEligible, canDeploy, canUseAutoDeploy, canUseCustomDomain, canUseEnvVars, assertMonthlyDeploymentQuota } from "@/lib/entitlements";
import { AppError } from "@/lib/errors";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections, userDeploymentsPath, userDomainsPath, userProjectPath, userProjectsPath } from "@/lib/firebase/collections";
import { ensureRepoWebhook, getLatestCommit } from "@/lib/github/client";
import { createNotification } from "@/lib/notifications/create";
import { claimSubdomain, releaseSubdomain } from "@/lib/domains/subdomains";
import { slugify, nowIso } from "@/lib/utils";
import { createVercelProject, deleteVercelProject, upsertVercelEnvVars } from "@/lib/vercel/projects";
import { createGitDeployment, getVercelDeployment, mapVercelReadyState } from "@/lib/vercel/deployments";
import { addProjectDomain, getDomainConfig, getProjectDomain, removeProjectDomain, verifyProjectDomain } from "@/lib/vercel/domains";
import { logger } from "@/lib/logger";
import type { Deployment, Project, ProjectDomain, ProjectStatus } from "@/types";

function vercelProjectName(uid: string, name: string) {
  const base = slugify(`vdx-${name}`).slice(0, 40);
  return `${base}-${uid.slice(0, 6)}`.toLowerCase();
}

export async function createAndDeployProject(uid: string, input: {
  name: string;
  repository: string;
  repositoryId: string;
  owner: string;
  repo: string;
  branch: string;
  framework?: string | null;
  envVars?: { key: string; value: string }[];
  platformSubdomain?: string | null;
  autoDeploy?: boolean;
}) {
  const { user, plan } = await canDeploy(uid);
  await assertMonthlyDeploymentQuota(uid, plan);
  if (input.envVars && input.envVars.length > 0) {
    await canUseEnvVars(uid);
  }
  if (input.autoDeploy) {
    await canUseAutoDeploy(uid);
  }

  const db = getAdminDb();
  const projectId = nanoid();
  const deploymentId = nanoid();
  const projectRef = db.doc(userProjectPath(uid, projectId));
  const userRef = db.collection(collections.users).doc(uid);
  const timestamp = nowIso();

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const data = userSnap.data() ?? {};
    const count = Number(data.websiteCount ?? 0);
    const limit = Number(data.websiteLimit ?? 0);
    if (count >= limit) {
      throw new AppError(
        "PLAN_LIMIT",
        "You've reached your current plan limit. Upgrade your plan to deploy more websites.",
        403,
        { used: count, limit, planName: user.activePlanName ?? plan?.planName ?? "current" },
      );
    }
    tx.update(userRef, { websiteCount: count + 1, updatedAt: timestamp });
    tx.set(projectRef, {
      projectId,
      userId: uid,
      name: input.name,
      slug: slugify(input.name),
      repository: input.repository,
      repositoryId: input.repositoryId,
      owner: input.owner,
      repo: input.repo,
      branch: input.branch,
      framework: input.framework ?? null,
      vercelProjectId: null,
      vercelProjectName: null,
      latestDeploymentId: deploymentId,
      deploymentUrl: null,
      platformSubdomain: null,
      customDomain: null,
      status: "creating" satisfies ProjectStatus,
      envVarsConfigured: Boolean(input.envVars?.length),
      autoDeploy: Boolean(input.autoDeploy),
      countsTowardLimit: true,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies Project);
  });

  try {
    const vercelName = vercelProjectName(uid, input.name);
    const vercelProject = await createVercelProject({
      name: vercelName,
      framework: input.framework,
      environmentVariables: input.envVars,
    });

    const commit = await getLatestCommit(uid, input.owner, input.repo, input.branch);
    const vercelDeployment = await createGitDeployment({
      name: vercelName,
      project: vercelProject.id,
      repo: input.repository,
      ref: input.branch,
      repoId: input.repositoryId,
    });

    let platformSubdomain: string | null = null;
    if (input.platformSubdomain) {
      const claimed = await claimSubdomain({
        subdomain: input.platformSubdomain,
        uid,
        projectId,
      });
      platformSubdomain = claimed.subdomain;
      try {
        await addProjectDomain(vercelProject.id, claimed.hostname);
      } catch (error) {
        logger.warn("Failed to attach platform subdomain", {
          projectId,
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    if (input.autoDeploy) {
      const secret = readEnv("GITHUB_WEBHOOK_SECRET") || readEnv("CRON_SECRET");
      if (secret) {
        await ensureRepoWebhook(
          uid,
          input.owner,
          input.repo,
          `${getAppUrl()}/api/github/webhook`,
          secret,
        );
      }
    }

    const mapped = mapVercelReadyState(vercelDeployment.readyState);
    const deployment: Deployment = {
      deploymentId,
      projectId,
      userId: uid,
      vercelDeploymentId: vercelDeployment.id,
      url: vercelDeployment.url ? `https://${vercelDeployment.url}` : null,
      inspectorUrl: vercelDeployment.inspectorUrl ?? null,
      branch: input.branch,
      commitSha: commit.sha,
      commitMessage: commit.message,
      status: mapped,
      readyState: vercelDeployment.readyState ?? null,
      errorMessage: null,
      createdAt: timestamp,
      completedAt: mapped === "ready" || mapped === "error" ? nowIso() : null,
    };

    await db.doc(`${userDeploymentsPath(uid, projectId)}/${deploymentId}`).set(deployment);
    await projectRef.set(
      {
        vercelProjectId: vercelProject.id,
        vercelProjectName: vercelProject.name,
        latestDeploymentId: deploymentId,
        deploymentUrl: deployment.url,
        platformSubdomain,
        status: mapped === "ready" ? "ready" : mapped === "error" ? "error" : "deploying",
        lastError: null,
        updatedAt: nowIso(),
      },
      { merge: true },
    );

    if (mapped === "ready") {
      await createNotification({
        uid,
        type: "deployment_success",
        title: "Deployment successful",
        message: `${input.name} is live.`,
        href: `/dashboard/projects/${projectId}`,
      });
    }

    return { projectId, deploymentId, status: deployment.status, url: deployment.url };
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Deployment failed. Please try again.";
    await projectRef.set(
      {
        status: "error",
        lastError: message,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
    await db.doc(`${userDeploymentsPath(uid, projectId)}/${deploymentId}`).set({
      deploymentId,
      projectId,
      userId: uid,
      vercelDeploymentId: null,
      url: null,
      inspectorUrl: null,
      branch: input.branch,
      commitSha: null,
      commitMessage: null,
      status: "error",
      readyState: "ERROR",
      errorMessage: message,
      createdAt: timestamp,
      completedAt: nowIso(),
    } satisfies Deployment);
    await createNotification({
      uid,
      type: "deployment_failed",
      title: "Deployment failed",
      message,
      href: `/dashboard/projects/${projectId}`,
    });
    throw error instanceof AppError
      ? error
      : new AppError("VERCEL_ERROR", message, 502);
  }
}

export async function redeployProject(uid: string, projectId: string) {
  const { plan } = await assertSubscriptionEligible(uid);
  await assertMonthlyDeploymentQuota(uid, plan);

  const db = getAdminDb();
  const projectSnap = await db.doc(userProjectPath(uid, projectId)).get();
  if (!projectSnap.exists) throw new AppError("NOT_FOUND", "Project not found.", 404);
  const project = projectSnap.data() as Project;
  if (!project.vercelProjectId) {
    throw new AppError("VERCEL_ERROR", "This project is not linked to deployment infrastructure yet.", 409);
  }

  const commit = await getLatestCommit(uid, project.owner, project.repo, project.branch);
  const vercelDeployment = await createGitDeployment({
    name: project.vercelProjectName || project.slug,
    project: project.vercelProjectId,
    repo: project.repository,
    ref: project.branch,
    repoId: project.repositoryId,
  });
  const deploymentId = nanoid();
  const mapped = mapVercelReadyState(vercelDeployment.readyState);
  const deployment: Deployment = {
    deploymentId,
    projectId,
    userId: uid,
    vercelDeploymentId: vercelDeployment.id,
    url: vercelDeployment.url ? `https://${vercelDeployment.url}` : null,
    inspectorUrl: vercelDeployment.inspectorUrl ?? null,
    branch: project.branch,
    commitSha: commit.sha,
    commitMessage: commit.message,
    status: mapped,
    readyState: vercelDeployment.readyState ?? null,
    errorMessage: null,
    createdAt: nowIso(),
    completedAt: mapped === "ready" || mapped === "error" ? nowIso() : null,
  };
  await db.doc(`${userDeploymentsPath(uid, projectId)}/${deploymentId}`).set(deployment);
  await projectSnap.ref.set(
    {
      latestDeploymentId: deploymentId,
      deploymentUrl: deployment.url,
      status: mapped === "ready" ? "ready" : mapped === "error" ? "error" : "deploying",
      lastError: null,
      updatedAt: nowIso(),
    },
    { merge: true },
  );
  return deployment;
}

export async function syncDeploymentStatus(uid: string, projectId: string, deploymentId: string) {
  const db = getAdminDb();
  const ref = db.doc(`${userDeploymentsPath(uid, projectId)}/${deploymentId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError("NOT_FOUND", "Deployment not found.", 404);
  const deployment = snap.data() as Deployment;
  if (!deployment.vercelDeploymentId) return deployment;
  const remote = await getVercelDeployment(deployment.vercelDeploymentId);
  const mapped = mapVercelReadyState(remote.readyState);
  const next = {
    ...deployment,
    url: remote.url ? `https://${remote.url}` : deployment.url,
    inspectorUrl: remote.inspectorUrl ?? deployment.inspectorUrl,
    status: mapped,
    readyState: remote.readyState ?? deployment.readyState,
    completedAt:
      mapped === "ready" || mapped === "error" || mapped === "cancelled"
        ? deployment.completedAt ?? nowIso()
        : null,
  };
  await ref.set(next, { merge: true });
  await db.doc(userProjectPath(uid, projectId)).set(
    {
      status: mapped === "ready" ? "ready" : mapped === "error" ? "error" : "deploying",
      deploymentUrl: next.url,
      updatedAt: nowIso(),
    },
    { merge: true },
  );
  if (mapped === "ready" && deployment.status !== "ready") {
    await createNotification({
      uid,
      type: "deployment_success",
      title: "Deployment successful",
      message: "Your latest deployment is live.",
      href: `/dashboard/projects/${projectId}`,
    });
  }
  if (mapped === "error" && deployment.status !== "error") {
    await createNotification({
      uid,
      type: "deployment_failed",
      title: "Deployment failed",
      message: "The latest deployment did not complete.",
      href: `/dashboard/projects/${projectId}`,
    });
  }
  return next;
}

export async function updateProjectEnv(uid: string, projectId: string, envVars: { key: string; value: string }[]) {
  await canUseEnvVars(uid);
  const db = getAdminDb();
  const snap = await db.doc(userProjectPath(uid, projectId)).get();
  if (!snap.exists) throw new AppError("NOT_FOUND", "Project not found.", 404);
  const project = snap.data() as Project;
  if (!project.vercelProjectId) {
    throw new AppError("VERCEL_ERROR", "Project infrastructure is not ready.", 409);
  }
  await upsertVercelEnvVars(project.vercelProjectId, envVars);
  await snap.ref.set({ envVarsConfigured: true, updatedAt: nowIso() }, { merge: true });
}

export async function attachPlatformSubdomain(uid: string, projectId: string, subdomain: string) {
  const db = getAdminDb();
  const snap = await db.doc(userProjectPath(uid, projectId)).get();
  if (!snap.exists) throw new AppError("NOT_FOUND", "Project not found.", 404);
  const project = snap.data() as Project;
  if (!project.vercelProjectId) throw new AppError("VERCEL_ERROR", "Deploy the project before assigning a domain.", 409);
  const claimed = await claimSubdomain({ subdomain, uid, projectId });
  await addProjectDomain(project.vercelProjectId, claimed.hostname);
  const domainId = nanoid();
  await db.doc(`${userDomainsPath(uid, projectId)}/${domainId}`).set({
    domainId,
    projectId,
    userId: uid,
    domain: claimed.hostname,
    type: "platform",
    status: "pending",
    verified: false,
    sslReady: false,
    verification: null,
    recommendedCNAME: `cname.vercel-dns.com`,
    recommendedA: null,
    recommendedAAAA: null,
    lastCheckedAt: nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  } satisfies ProjectDomain);
  await snap.ref.set({ platformSubdomain: claimed.subdomain, updatedAt: nowIso() }, { merge: true });
  return claimed;
}

export async function attachCustomDomain(uid: string, projectId: string, domain: string) {
  await canUseCustomDomain(uid);
  const db = getAdminDb();
  const snap = await db.doc(userProjectPath(uid, projectId)).get();
  if (!snap.exists) throw new AppError("NOT_FOUND", "Project not found.", 404);
  const project = snap.data() as Project;
  if (!project.vercelProjectId) throw new AppError("VERCEL_ERROR", "Deploy the project before connecting a domain.", 409);
  const hostname = domain.toLowerCase().trim();
  const indexRef = db.collection(collections.domainIndex).doc(hostname);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(indexRef);
    if (existing.exists && existing.data()?.projectId !== projectId) {
      throw new AppError("CONFLICT", "This domain is already connected to another project.", 409);
    }
    tx.set(indexRef, { domain: hostname, uid, projectId, createdAt: nowIso() });
  });
  const vercelDomain = await addProjectDomain(project.vercelProjectId, hostname);
  const config = await getDomainConfig(hostname).catch(() => null);
  const domainId = nanoid();
  const record: ProjectDomain = {
    domainId,
    projectId,
    userId: uid,
    domain: hostname,
    type: "custom",
    status: vercelDomain.verified ? "verified" : "pending",
    verified: Boolean(vercelDomain.verified),
    sslReady: Boolean(vercelDomain.verified),
    verification: vercelDomain.verification ?? null,
    recommendedCNAME: config?.recommendedCNAME?.[0]?.value ?? config?.cnames?.[0] ?? null,
    recommendedA: config?.recommendedIPv4?.[0]?.value ?? config?.aValues?.[0] ?? null,
    recommendedAAAA: config?.recommendedIPv6?.[0]?.value ?? config?.aaaaValues?.[0] ?? null,
    lastCheckedAt: nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.doc(`${userDomainsPath(uid, projectId)}/${domainId}`).set(record);
  await snap.ref.set({ customDomain: hostname, updatedAt: nowIso() }, { merge: true });
  return record;
}

export async function refreshDomain(uid: string, projectId: string, domainId: string) {
  const db = getAdminDb();
  const ref = db.doc(`${userDomainsPath(uid, projectId)}/${domainId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError("NOT_FOUND", "Domain not found.", 404);
  const domain = snap.data() as ProjectDomain;
  const projectSnap = await db.doc(userProjectPath(uid, projectId)).get();
  const project = projectSnap.data() as Project;
  if (!project.vercelProjectId) throw new AppError("VERCEL_ERROR", "Project infrastructure is not ready.", 409);
  let verified = domain.verified;
  try {
    const result = await verifyProjectDomain(project.vercelProjectId, domain.domain);
    verified = Boolean(result.verified);
  } catch {
    const current = await getProjectDomain(project.vercelProjectId, domain.domain);
    verified = Boolean(current.verified);
  }
  const config = await getDomainConfig(domain.domain).catch(() => null);
  const next: ProjectDomain = {
    ...domain,
    verified,
    sslReady: verified,
    status: verified ? "verified" : config?.misconfigured ? "error" : "pending",
    recommendedCNAME: config?.recommendedCNAME?.[0]?.value ?? domain.recommendedCNAME,
    recommendedA: config?.recommendedIPv4?.[0]?.value ?? domain.recommendedA,
    recommendedAAAA: config?.recommendedIPv6?.[0]?.value ?? domain.recommendedAAAA,
    lastCheckedAt: nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(next, { merge: true });
  await createNotification({
    uid,
    type: verified ? "domain_verified" : "domain_failed",
    title: verified ? "Domain verified" : "Domain verification pending",
    message: verified
      ? `${domain.domain} is verified.`
      : `${domain.domain} is not verified yet. Recheck DNS records.`,
    href: `/dashboard/projects/${projectId}`,
  });
  return next;
}

export async function removeDomain(uid: string, projectId: string, domainId: string) {
  const db = getAdminDb();
  const ref = db.doc(`${userDomainsPath(uid, projectId)}/${domainId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError("NOT_FOUND", "Domain not found.", 404);
  const domain = snap.data() as ProjectDomain;
  const projectSnap = await db.doc(userProjectPath(uid, projectId)).get();
  const project = projectSnap.data() as Project;
  if (project.vercelProjectId) {
    await removeProjectDomain(project.vercelProjectId, domain.domain).catch((error) => {
      logger.warn("Vercel domain removal failed", {
        domain: domain.domain,
        message: error instanceof Error ? error.message : "unknown",
      });
    });
  }
  if (domain.type === "platform") {
    const sub = domain.domain.replace(`.${getMainDomain()}`, "");
    await releaseSubdomain(sub, projectId);
    await projectSnap.ref.set({ platformSubdomain: null, updatedAt: nowIso() }, { merge: true });
  } else {
    await db.collection(collections.domainIndex).doc(domain.domain).delete().catch(() => undefined);
    await projectSnap.ref.set({ customDomain: null, updatedAt: nowIso() }, { merge: true });
  }
  await ref.delete();
}

export async function deleteUserProject(uid: string, projectId: string) {
  const db = getAdminDb();
  const ref = db.doc(userProjectPath(uid, projectId));
  const snap = await ref.get();
  if (!snap.exists) throw new AppError("NOT_FOUND", "Project not found.", 404);
  const project = snap.data() as Project;
  if (project.vercelProjectId) {
    await deleteVercelProject(project.vercelProjectId).catch((error) => {
      logger.warn("Vercel project deletion failed", {
        projectId,
        message: error instanceof Error ? error.message : "unknown",
      });
    });
  }
  if (project.platformSubdomain) {
    await releaseSubdomain(project.platformSubdomain, projectId);
  }
  if (project.customDomain) {
    await db.collection(collections.domainIndex).doc(project.customDomain).delete().catch(() => undefined);
  }
  const [deployments, domains] = await Promise.all([
    db.collection(userDeploymentsPath(uid, projectId)).get(),
    db.collection(userDomainsPath(uid, projectId)).get(),
  ]);
  const batch = db.batch();
  deployments.docs.forEach((doc) => batch.delete(doc.ref));
  domains.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(ref);
  await batch.commit();

  if (project.countsTowardLimit && HOSTED_PROJECT_STATUSES.includes(project.status as (typeof HOSTED_PROJECT_STATUSES)[number])) {
    const userRef = db.collection(collections.users).doc(uid);
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const count = Number(userSnap.data()?.websiteCount ?? 0);
      tx.update(userRef, { websiteCount: Math.max(0, count - 1), updatedAt: nowIso() });
    });
  }
}

export async function listUserProjects(uid: string) {
  const db = getAdminDb();
  try {
    const snap = await db.collection(userProjectsPath(uid)).orderBy("createdAt", "desc").get();
    return snap.docs.map((doc) => doc.data() as Project);
  } catch {
    const snap = await db.collection(userProjectsPath(uid)).get();
    return snap.docs
      .map((doc) => doc.data() as Project)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
}

export async function listRecentDeployments(uid: string, limit = 8) {
  const projects = await listUserProjects(uid).catch(() => [] as Project[]);
  const db = getAdminDb();
  const batches = await Promise.all(
    projects.slice(0, 25).map(async (project) => {
      const snap = await db
        .collection(userDeploymentsPath(uid, project.projectId))
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
      return snap.docs.map((doc) => doc.data() as Deployment);
    }),
  );
  return batches
    .flat()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}
