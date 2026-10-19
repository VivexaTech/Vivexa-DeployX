import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteProject, EnvVarManager, GitWebhookSettings, ProjectSettingsForm } from "@/components/deployment/project-settings";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getIntegrationStatus } from "@/lib/env";
import type { EnvironmentVariable, Project } from "@/types/database";

export const metadata: Metadata = { title: "Project Settings" };

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const [projectRes, envRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("environment_variables").select("id, key, is_secret, targets, updated_at").eq("project_id", id).order("key"),
  ]);
  if (!projectRes.data) notFound();
  const project = projectRes.data as Project;
  const variables = (envRes.data as Pick<EnvironmentVariable, "id" | "key" | "is_secret" | "targets" | "updated_at">[]) ?? [];

  return (
    <div className="space-y-6">
      <ProjectSettingsForm project={project} />
      <GitWebhookSettings project={project} />
      <EnvVarManager projectId={project.id} initial={variables} encryptionConfigured={getIntegrationStatus().encryption} />
      <DeleteProject projectId={project.id} projectName={project.name} />
    </div>
  );
}
