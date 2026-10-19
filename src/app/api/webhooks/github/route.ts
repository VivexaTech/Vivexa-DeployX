import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProjectWebhookSecret, verifyGitHubSignature } from "@/lib/github/webhooks";
import { queueDeployment, runDeployment } from "@/lib/deployment/service";
import type { Project } from "@/types/database";

export const dynamic = "force-dynamic";

interface GitHubPushPayload {
  ref: string;
  before: string;
  after: string;
  created: boolean;
  deleted: boolean;
  forced: boolean;
  head_commit: {
    id: string;
    message: string;
    timestamp: string;
    author: { name: string; email: string; username?: string };
    committer: { name: string; email: string; username?: string };
  } | null;
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: { login?: string; name?: string };
  };
  pusher?: { name?: string; email?: string };
  sender?: { login?: string; avatar_url?: string };
}

/**
 * Inbound GitHub Webhook handler for Automatic Git Deployments.
 * Verifies HMAC signature, enforces idempotency via webhook_events,
 * matches the configured production branch, and starts a deployment.
 */
export async function POST(request: Request) {
  const admin = createAdminClient();
  const rawBody = await request.text();
  const event = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery");
  const signature = request.headers.get("x-hub-signature-256");

  if (!event) {
    return NextResponse.json({ error: "Missing X-GitHub-Event header" }, { status: 400 });
  }

  // Handle GitHub Ping event (webhook ping check)
  if (event === "ping") {
    return NextResponse.json({ ok: true, pong: true });
  }

  // Only handle push events
  if (event !== "push") {
    return NextResponse.json({ ok: true, ignored: `Event '${event}' is not handled` });
  }

  let payload: GitHubPushPayload;
  try {
    payload = JSON.parse(rawBody) as GitHubPushPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // If the push event was a branch deletion, ignore
  if (payload.deleted) {
    return NextResponse.json({ ok: true, ignored: "Branch deletion event" });
  }

  // 1. Idempotency store check (prevent duplicate deployments from redelivered webhooks)
  if (deliveryId) {
    const { error: dupError } = await admin.from("webhook_events").insert({
      provider: "github",
      event_id: deliveryId,
      event_type: "push",
      payload: {
        repo: payload.repository?.full_name,
        ref: payload.ref,
        after: payload.after,
      },
    });

    if (dupError) {
      if (dupError.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true, message: "Delivery already processed" });
      }
      console.error("[github webhook] idempotency record error:", dupError.message);
    }
  }

  // 2. Parse target branch from ref (e.g., 'refs/heads/main' -> 'main')
  const branch = payload.ref?.replace(/^refs\/heads\//, "");
  if (!branch) {
    return NextResponse.json({ ok: true, ignored: "Not a branch push" });
  }

  // 3. Find target project(s)
  const url = new URL(request.url);
  const projectIdParam = url.searchParams.get("projectId");
  const repoOwner = payload.repository?.owner?.login ?? payload.repository?.owner?.name ?? "";
  const repoName = payload.repository?.name ?? "";
  const repoId = payload.repository?.id;

  let query = admin.from("projects").select("*");
  if (projectIdParam) {
    query = query.eq("id", projectIdParam);
  } else {
    // Match by repo owner + name or repo id
    if (repoOwner && repoName) {
      query = query.ilike("repo_owner", repoOwner).ilike("repo_name", repoName);
    } else if (repoId) {
      query = query.eq("repo_id", repoId);
    } else {
      return NextResponse.json({ error: "Could not identify repository" }, { status: 400 });
    }
  }

  const { data: projectRows, error: projectError } = await query;
  if (projectError || !projectRows || projectRows.length === 0) {
    return NextResponse.json({ ok: true, ignored: "No matching project found" });
  }

  const projects = projectRows as Project[];

  // 4. Verify signature against projects or environment variable
  const globalSecret = process.env.GITHUB_WEBHOOK_SECRET;
  let signatureValid = false;

  if (globalSecret && verifyGitHubSignature(rawBody, signature, globalSecret)) {
    signatureValid = true;
  } else {
    // Verify against project secrets
    for (const project of projects) {
      const secret = getProjectWebhookSecret(project);
      if (verifyGitHubSignature(rawBody, signature, secret)) {
        signatureValid = true;
        break;
      }
    }
  }

  if (!signatureValid) {
    console.warn("[github webhook] invalid signature for delivery", deliveryId);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  // 5. Process matching projects with automatic deployment enabled
  const commitSha = payload.after || payload.head_commit?.id || "";
  const commitMessage = payload.head_commit?.message?.slice(0, 200) || "Automatic deployment on git push";
  const commitAuthor =
    payload.head_commit?.author?.username ||
    payload.head_commit?.author?.name ||
    payload.pusher?.name ||
    payload.sender?.login ||
    "github";

  const queuedDeployments: { projectId: string; deploymentId: string }[] = [];

  for (const project of projects) {
    // Check if auto_deploy is disabled (defaults to true if null/undefined)
    if (project.auto_deploy === false) {
      continue;
    }

    // Branch-specific check: only trigger if pushed branch matches project production branch
    if (project.branch !== branch) {
      continue;
    }

    // Prevent duplicate deployment for the exact same commit if already queued or building
    const { data: recentForCommit } = await admin
      .from("deployments")
      .select("id, status")
      .eq("project_id", project.id)
      .eq("commit_sha", commitSha)
      .in("status", ["queued", "building", "deploying"])
      .limit(1);

    if (recentForCommit && recentForCommit.length > 0) {
      console.info(`[github webhook] Deployment already in progress for project ${project.id} commit ${commitSha.slice(0, 7)}`);
      continue;
    }

    try {
      const deployment = await queueDeployment(project.user_id, project.id, {
        branch,
        commitSha,
        commitMessage,
        commitAuthor,
      });

      after(() => runDeployment(deployment.id));
      queuedDeployments.push({ projectId: project.id, deploymentId: deployment.id });
    } catch (deployErr) {
      console.error(`[github webhook] Failed to queue deployment for project ${project.id}:`, deployErr);
    }
  }

  return NextResponse.json({
    ok: true,
    triggered: queuedDeployments.length,
    deployments: queuedDeployments,
  });
}
