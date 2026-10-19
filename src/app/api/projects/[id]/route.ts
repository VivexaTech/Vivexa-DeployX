import { NextResponse } from "next/server";
import { withUser } from "@/lib/security/api";
import { projectSettingsSchema } from "@/lib/validation";
import { getOwnedProject } from "@/lib/data/projects";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrations } from "@/lib/env";
import { getFramework } from "@/lib/frameworks";
import { toPublicVercelError } from "@/lib/vercel/client";
import { deleteVercelProject, updateVercelProject } from "@/lib/vercel/projects";
import { removeProjectDomain } from "@/lib/vercel/domains";
import { PublicError } from "@/lib/utils/sanitize";
import type { Project } from "@/types/database";

export const PATCH = withUser({ schema: projectSettingsSchema }, async ({ user, body, params }) => {
  const project = await getOwnedProject(user.id, params.id);

  if (project.provider_project_id && integrations.vercel()) {
    try {
      await updateVercelProject(project.provider_project_id, {
        framework: getFramework(body.framework).providerSlug,
        buildCommand: body.buildCommand,
        installCommand: body.installCommand,
        outputDirectory: body.outputDirectory,
        rootDirectory: body.rootDirectory || null,
      });
    } catch (error) {
      throw toPublicVercelError(error, "Could not update infrastructure project settings");
    }
  }

  const updates: Record<string, unknown> = {
    name: body.name,
    branch: body.branch,
    framework: body.framework,
    root_directory: body.rootDirectory,
    build_command: body.buildCommand,
    install_command: body.installCommand,
    output_directory: body.outputDirectory,
  };

  if (typeof body.autoDeploy === "boolean") {
    updates.auto_deploy = body.autoDeploy;
  }
  if (body.webhookSecret) {
    updates.webhook_secret = body.webhookSecret;
  }

  const admin = createAdminClient();
  let { data, error } = await admin
    .from("projects")
    .update(updates)
    .eq("id", project.id)
    .select("*")
    .single();

  if (error && error.code === "42703") {
    // If auto_deploy / webhook_secret columns aren't in database yet, retry without them
    delete updates.auto_deploy;
    delete updates.webhook_secret;
    const retry = await admin.from("projects").update(updates).eq("id", project.id).select("*").single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new PublicError("Could not update project.", 500);

  const sanitized = {
    ...(data as Project),
    provider: "deployx",
  };

  return NextResponse.json({ project: sanitized });
});

export const DELETE = withUser({ rateLimit: { key: "project-delete", limit: 10, windowMs: 60_000 } }, async ({ user, params }) => {
  const project = await getOwnedProject(user.id, params.id);
  const admin = createAdminClient();

  if (project.provider_project_id && integrations.vercel()) {
    const { data: domains } = await admin.from("domains").select("name").eq("project_id", project.id);
    for (const domain of (domains as { name: string }[]) ?? []) {
      await removeProjectDomain(project.provider_project_id, domain.name).catch(() => undefined);
    }
    try {
      await deleteVercelProject(project.provider_project_id);
    } catch (error) {
      throw toPublicVercelError(error, "Could not remove the infrastructure project");
    }
  }

  await admin.from("projects").delete().eq("id", project.id);
  return NextResponse.json({ ok: true });
});
