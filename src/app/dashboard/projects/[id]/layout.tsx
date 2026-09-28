import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { LinkTabs } from "@/components/ui/tabs";
import { DeployButton } from "@/components/deployment/deploy-button";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getIntegrationStatus } from "@/lib/env";
import type { Project } from "@/types/database";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!data) notFound();
  const project = data as Project;
  const status = getIntegrationStatus();
  const disabledReason = !status.vercel
    ? "Vercel integration is not configured. Configure VERCEL_TOKEN to enable real deployments."
    : !status.github
      ? "GitHub integration is not configured."
      : null;

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${project.repo_owner}/${project.repo_name}`}
        breadcrumb={[{ label: "Projects", href: "/dashboard/projects" }, { label: project.name }]}
        actions={
          <>
            {project.production_url && (
              <ButtonLink href={project.production_url} external variant="outline">
                Visit <ExternalLink className="h-4 w-4" />
              </ButtonLink>
            )}
            <DeployButton projectId={project.id} redeploy={Boolean(project.last_deployed_at)} disabledReason={disabledReason} />
          </>
        }
      />
      <LinkTabs
        tabs={[
          { label: "Overview", href: `/dashboard/projects/${project.id}`, exact: true },
          { label: "Settings", href: `/dashboard/projects/${project.id}/settings` },
        ]}
      />
      {children}
    </>
  );
}
