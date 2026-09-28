import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Globe, Plus, Rocket } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { DescriptionList } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { GithubIcon } from "@/components/ui/icons";
import { DeploymentsTable, type DeploymentWithProject } from "@/components/deployment/deployments-table";
import { DeploymentCard } from "@/components/deployment/deployment-card";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getFramework } from "@/lib/frameworks";
import { formatDate, timeAgo } from "@/lib/utils";
import type { Domain, Project } from "@/types/database";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const [projectRes, deploymentsRes, domainsRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("deployments")
      .select("*, project:projects(id, name)")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("domains").select("*").eq("project_id", id).order("created_at", { ascending: true }),
  ]);
  if (!projectRes.data) notFound();
  const project = projectRes.data as Project;
  const deployments = (deploymentsRes.data as DeploymentWithProject[]) ?? [];
  const domains = (domainsRes.data as Domain[]) ?? [];
  const framework = getFramework(project.framework);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-6 lg:grid-cols-[1fr_auto]">
          <DescriptionList
            items={[
              {
                label: "Production URL",
                value: project.production_url ? (
                  <a href={project.production_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                    {project.production_url.replace(/^https?:\/\//, "")}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="text-muted">Not deployed yet</span>
                ),
              },
              { label: "Status", value: <StatusBadge status={project.latest_deployment_status} /> },
              {
                label: "Repository",
                value: (
                  <a
                    href={`https://github.com/${project.repo_owner}/${project.repo_name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:underline"
                  >
                    <GithubIcon className="h-3.5 w-3.5" /> {project.repo_owner}/{project.repo_name}
                  </a>
                ),
              },
              { label: "Branch", value: project.branch },
              { label: "Framework", value: framework.name },
              { label: "Root Directory", value: project.root_directory || "./" },
              { label: "Last Deployed", value: project.last_deployed_at ? timeAgo(project.last_deployed_at) : "Never" },
              { label: "Created", value: formatDate(project.created_at) },
              { label: "Provider", value: project.provider_project_id ? "Linked" : "Not linked yet" },
            ]}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader title="Deployment history" description="The 20 most recent deployments." />
          {deployments.length === 0 ? (
            <EmptyState icon={<Rocket className="h-5 w-5" />} title="No deployments yet" description="Click Deploy to build and publish this project." />
          ) : (
            <>
              <div className="hidden md:block">
                <DeploymentsTable deployments={deployments} showProject={false} />
              </div>
              <div className="space-y-2 p-3 md:hidden">
                {deployments.map((d) => (
                  <DeploymentCard key={d.id} deployment={d} />
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader
            title="Domains"
            action={
              <ButtonLink href={`/dashboard/domains?add=1&project=${project.id}`} size="sm" variant="outline">
                <Plus className="h-4 w-4" /> Add
              </ButtonLink>
            }
          />
          {domains.length === 0 ? (
            <EmptyState icon={<Globe className="h-5 w-5" />} title="No domains" description="Add a DeployX subdomain or your own custom domain." />
          ) : (
            <ul className="divide-y divide-border">
              {domains.map((domain) => (
                <li key={domain.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/dashboard/domains#${domain.id}`} className="truncate text-[13px] font-medium text-foreground hover:underline">
                    {domain.name}
                  </Link>
                  <StatusBadge status={domain.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
