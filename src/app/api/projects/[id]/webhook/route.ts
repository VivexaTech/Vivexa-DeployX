import { NextResponse } from "next/server";
import { withUser } from "@/lib/security/api";
import { getOwnedProject } from "@/lib/data/projects";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserGithubToken } from "@/lib/github/client";
import { generateWebhookSecret, getProjectWebhookSecret, getWebhookUrl, setupRepoWebhook } from "@/lib/github/webhooks";
import { PublicError } from "@/lib/utils/sanitize";

export const dynamic = "force-dynamic";

/** Get webhook details and auto-deploy status for a project */
export const GET = withUser({}, async ({ user, params }) => {
  const project = await getOwnedProject(user.id, params.id);
  const webhookUrl = getWebhookUrl(project.id);
  const webhookSecret = getProjectWebhookSecret(project);

  return NextResponse.json({
    webhookUrl,
    webhookSecret,
    autoDeploy: project.auto_deploy ?? true,
    branch: project.branch,
  });
});

/** Automatically configure or reconfigure GitHub webhook on the repository */
export const POST = withUser({}, async ({ user, params }) => {
  const project = await getOwnedProject(user.id, params.id);
  const token = await getUserGithubToken(user.id);
  const admin = createAdminClient();

  // If project doesn't have a stored webhook_secret, generate one and save it
  let secret = project.webhook_secret;
  if (!secret) {
    secret = generateWebhookSecret();
    try {
      await admin
        .from("projects")
        .update({ webhook_secret: secret })
        .eq("id", project.id);
    } catch {
      // ignore if column does not exist yet
    }
  }

  const webhookUrl = getWebhookUrl(project.id);
  const result = await setupRepoWebhook(token, project.repo_owner, project.repo_name, webhookUrl, secret);

  if (!result.success) {
    throw new PublicError(
      result.error ?? "Failed to create webhook on GitHub. Please check permissions or configure manually.",
      400,
    );
  }

  return NextResponse.json({
    ok: true,
    hookId: result.hookId,
    webhookUrl,
    message: "GitHub webhook successfully configured for automatic deployments.",
  });
});
