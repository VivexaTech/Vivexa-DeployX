import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  Globe,
  Plus,
  Rocket,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { DescriptionList } from "@/components/ui/misc";
import { Alert, EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { GithubIcon } from "@/components/ui/icons";
import { DeploymentsTable, type DeploymentWithProject } from "@/components/deployment/deployments-table";
import { DeploymentCard } from "@/components/deployment/deployment-card";
import { DeploymentLive } from "@/components/deployment/deployment-live";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getFramework } from "@/lib/frameworks";
import { shortSha, timeAgo } from "@/lib/utils";
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

  // Identify current production deployment and latest deployment
  const productionDeployment =
    deployments.find((d) => d.id === project.production_deployment_id) ||
    deployments.find((d) => d.status === "ready") ||
    null;
  const latestDeployment = deployments[0] || null;
  const isLatestFailed = latestDeployment && latestDeployment.status === "error";
  const isLatestInProgress =
    latestDeployment && ["queued", "building", "deploying"].includes(latestDeployment.status);

  return (
    <div className="space-y-6">
      {/* Current Production Deployment Banner / Card */}
      {productionDeployment ? (
        <Card className="border-accent/40 bg-accent/5">
          <CardHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                <span>Production Deployment</span>
                <Badge tone="success" dot>
                  Live in Production
                </Badge>
              </span>
            }
            description={`Serving live traffic from branch ${productionDeployment.branch ?? project.branch}`}
            action={
              project.production_url ? (
                <div className="flex items-center gap-2">
                  <CopyButton value={project.production_url} label="Copy URL" />
                  <ButtonLink href={project.production_url} external size="sm" variant="primary">
                    Visit Site <ExternalLink className="h-3.5 w-3.5" />
                  </ButtonLink>
                </div>
              ) : undefined
            }
          />
          <CardContent className="space-y-3 pt-0">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/80 bg-background/80 p-3 text-[13px]">
              <div className="min-w-0">
                <span className="text-muted">Live URL: </span>
                {project.production_url ? (
                  <a
                    href={project.production_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-accent hover:underline"
                  >
                    {project.production_url.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                {productionDeployment.commit_sha && (
                  <span className="inline-flex items-center gap-1 font-mono">
                    <GitCommitHorizontal className="h-3.5 w-3.5" />
                    {shortSha(productionDeployment.commit_sha)}
                  </span>
                )}
                {productionDeployment.commit_message && (
                  <span className="max-w-xs truncate text-foreground">{productionDeployment.commit_message}</span>
                )}
                <span>Deployed {timeAgo(productionDeployment.ready_at || productionDeployment.created_at)}</span>
              </div>
            </div>

            {/* Health & Fallback Notice if latest deployment had an error */}
            {isLatestFailed && (
              <Alert tone="warning" className="text-xs">
                The latest build failed, but your production deployment remains live and healthy above without
                interruption.
              </Alert>
            )}

            {isLatestInProgress && (
              <Alert tone="info" className="text-xs">
                A new deployment is currently in progress. Traffic continues to be served from this active production
                deployment until the new build completes.
              </Alert>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Project & Git Integration Overview Card */}
      <Card>
        <CardHeader
          title="Project Overview"
          description="Configuration and connected Git repository."
          action={
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/projects/${project.id}/settings`}
                className="text-xs text-muted transition-colors hover:text-foreground"
              >
                Configure Git & Webhooks &rarr;
              </Link>
            </div>
          }
        />
        <CardContent>
          <DescriptionList
            items={[
              {
                label: "Production URL",
                value: project.production_url ? (
                  <a
                    href={project.production_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    {project.production_url.replace(/^https?:\/\//, "")}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="text-muted">Not deployed yet</span>
                ),
              },
              { label: "Deployment Status", value: <StatusBadge status={project.latest_deployment_status} /> },
              {
                label: "Connected Git Repository",
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
              {
                label: "Production Branch",
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5 text-accent" />
                    <span className="font-mono">{project.branch}</span>
                  </span>
                ),
              },
              {
                label: "Latest Commit",
                value: latestDeployment?.commit_sha ? (
                  <a
                    href={`https://github.com/${project.repo_owner}/${project.repo_name}/commit/${latestDeployment.commit_sha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-sm items-center gap-1.5 hover:underline"
                    title={latestDeployment.commit_message ?? undefined}
                  >
                    <GitCommitHorizontal className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono text-xs">{shortSha(latestDeployment.commit_sha)}</span>
                    <span className="truncate text-muted">{latestDeployment.commit_message}</span>
                  </a>
                ) : (
                  <span className="text-muted">—</span>
                ),
              },
              {
                label: "Automatic Git Deploy",
                value: (
                  <span className="inline-flex items-center gap-2">
                    <Badge tone={project.auto_deploy !== false ? "success" : "neutral"} dot>
                      {project.auto_deploy !== false ? "Enabled" : "Disabled"}
                    </Badge>
                    <span className="text-xs text-muted-soft">
                      {project.auto_deploy !== false ? `Auto-deploys on push to ${project.branch}` : "Paused"}
                    </span>
                  </span>
                ),
              },
              { label: "Framework", value: framework.name },
              { label: "Root Directory", value: project.root_directory || "./" },
              { label: "Last Deployed", value: project.last_deployed_at ? timeAgo(project.last_deployed_at) : "Never" },
              { label: "Deployment Engine", value: <Badge tone="neutral">DeployX Cloud Engine</Badge> },
            ]}
          />
        </CardContent>
      </Card>

      {/* Live / Latest Build Logs */}
      {latestDeployment && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Build Logs</h2>
              <StatusBadge status={latestDeployment.status} />
              {latestDeployment.commit_sha && (
                <span className="font-mono text-xs text-muted">({shortSha(latestDeployment.commit_sha)})</span>
              )}
            </div>
            <Link
              href={`/dashboard/deployments/${latestDeployment.id}`}
              className="text-xs text-muted hover:text-foreground"
            >
              Full log view &rarr;
            </Link>
          </div>
          <DeploymentLive deploymentId={latestDeployment.id} initialStatus={latestDeployment.status} />
        </div>
      )}

      {/* Grid: Deployment History & Domains */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader
            title="Deployment History"
            description="The 20 most recent deployments with commit details, statuses, and rollback options."
          />
          {deployments.length === 0 ? (
            <EmptyState
              icon={<Rocket className="h-5 w-5" />}
              title="No deployments yet"
              description="Click Deploy to build and publish this project."
            />
          ) : (
            <>
              <div className="hidden md:block">
                <DeploymentsTable
                  deployments={deployments}
                  showProject={false}
                  productionDeploymentId={productionDeployment?.id}
                />
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
            <EmptyState
              icon={<Globe className="h-5 w-5" />}
              title="No domains"
              description="Add a DeployX subdomain or your own custom domain."
            />
          ) : (
            <ul className="divide-y divide-border">
              {domains.map((domain) => (
                <li key={domain.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link
                    href={`/dashboard/domains#${domain.id}`}
                    className="truncate text-[13px] font-medium text-foreground hover:underline"
                  >
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
