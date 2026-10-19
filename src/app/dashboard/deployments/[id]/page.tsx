import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, GitCommitHorizontal, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { DescriptionList, PageHeader } from "@/components/ui/misc";
import { Alert, EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { DeployButton } from "@/components/deployment/deploy-button";
import { DeploymentLive } from "@/components/deployment/deployment-live";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getIntegrationStatus } from "@/lib/env";
import { getFramework } from "@/lib/frameworks";
import { formatDate, formatDuration, shortSha, timeAgo } from "@/lib/utils";
import type { Deployment, Domain, EnvironmentVariable, Project } from "@/types/database";

export const metadata: Metadata = { title: "Deployment" };

export default async function DeploymentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from("deployments").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!data) notFound();
  const deployment = data as Deployment;

  const [projectRes, domainsRes, envRes, historyRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", deployment.project_id).maybeSingle(),
    supabase.from("domains").select("*").eq("project_id", deployment.project_id).order("created_at"),
    supabase.from("environment_variables").select("id, key, targets").eq("project_id", deployment.project_id).order("key"),
    supabase
      .from("deployments")
      .select("id, status, commit_sha, commit_message, created_at")
      .eq("project_id", deployment.project_id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const project = projectRes.data as Project | null;
  if (!project) notFound();
  const domains = (domainsRes.data as Domain[]) ?? [];
  const variables = (envRes.data as Pick<EnvironmentVariable, "id" | "key" | "targets">[]) ?? [];
  const history = (historyRes.data as Pick<Deployment, "id" | "status" | "commit_sha" | "commit_message" | "created_at">[]) ?? [];

  const status = getIntegrationStatus();
  const disabledReason = !status.vercel ? "Deployment infrastructure is not configured. Configure platform deployment credentials to enable real deployments." : null;
  const framework = getFramework(project.framework);
  const duration = deployment.ready_at ? formatDuration(deployment.build_started_at ?? deployment.created_at, deployment.ready_at) : null;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Deployment <StatusBadge status={deployment.status} />
          </span>
        }
        description={`${project.name} · ${timeAgo(deployment.created_at)}`}
        breadcrumb={[
          { label: "Deployments", href: "/dashboard/deployments" },
          { label: project.name, href: `/dashboard/projects/${project.id}` },
          { label: deployment.commit_sha ? shortSha(deployment.commit_sha) : deployment.id.slice(0, 8) },
        ]}
        actions={
          <>
            {deployment.url && deployment.status === "ready" && (
              <ButtonLink href={deployment.url} external variant="outline">
                Visit <ExternalLink className="h-4 w-4" />
              </ButtonLink>
            )}
            <DeployButton projectId={project.id} redeploy disabledReason={disabledReason} />
          </>
        }
      />

      {deployment.status === "error" && deployment.error_message && (
        <Alert tone="danger" className="mb-6">
          {deployment.error_message}
        </Alert>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader title="Overview" />
          <CardContent>
            <DescriptionList
              items={[
                { label: "Status", value: <StatusBadge status={deployment.status} /> },
                {
                  label: "Deployment URL",
                  value: deployment.url ? (
                    <a href={deployment.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {deployment.url.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Production URL",
                  value: project.production_url ? (
                    <a href={project.production_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {project.production_url.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    "—"
                  ),
                },
                { label: "Branch", value: deployment.branch ?? "—" },
                {
                  label: "Commit",
                  value: deployment.commit_sha ? (
                    <a
                      href={`https://github.com/${project.repo_owner}/${project.repo_name}/commit/${deployment.commit_sha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 hover:underline"
                      title={deployment.commit_message ?? undefined}
                    >
                      <GitCommitHorizontal className="h-3.5 w-3.5" />
                      <span className="font-mono text-xs">{shortSha(deployment.commit_sha)}</span>
                      <span className="truncate text-muted">{deployment.commit_message}</span>
                    </a>
                  ) : (
                    "—"
                  ),
                },
                { label: "Author", value: deployment.commit_author ?? "—" },
                { label: "Created", value: formatDate(deployment.created_at, true) },
                { label: "Build Duration", value: duration ?? (deployment.status === "ready" ? "—" : "In progress") },
                { label: "Environment", value: <span className="capitalize">{deployment.target}</span> },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Build Information" />
          <CardContent>
            <DescriptionList
              items={[
                { label: "Framework", value: framework.name },
                { label: "Root Directory", value: project.root_directory || "./" },
                { label: "Build Command", value: <code className="font-mono text-xs">{project.build_command ?? framework.buildCommand ?? "Default"}</code> },
                { label: "Install Command", value: <code className="font-mono text-xs">{project.install_command ?? framework.installCommand ?? "Default"}</code> },
                { label: "Output Directory", value: <code className="font-mono text-xs">{project.output_directory ?? framework.outputDirectory ?? "Default"}</code> },
                { label: "Repository", value: `${project.repo_owner}/${project.repo_name}` },
              ]}
            />
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Build Logs</h2>
          <DeploymentLive deploymentId={deployment.id} initialStatus={deployment.status} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="overflow-hidden">
            <CardHeader
              title="Environment Variables"
              action={
                <Link href={`/dashboard/projects/${project.id}/settings`} className="text-xs text-muted hover:text-foreground">
                  Manage
                </Link>
              }
            />
            {variables.length === 0 ? (
              <EmptyState icon={<KeyRound className="h-5 w-5" />} title="No variables" className="py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {variables.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <span className="truncate font-mono text-xs text-foreground">{v.key}</span>
                    <span className="font-mono text-xs text-muted-soft">••••••</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Domains"
              action={
                <Link href="/dashboard/domains" className="text-xs text-muted hover:text-foreground">
                  Manage
                </Link>
              }
            />
            {domains.length === 0 ? (
              <EmptyState title="No domains" className="py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {domains.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <span className="truncate text-[13px] text-foreground">{d.name}</span>
                    <StatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Deployment History" />
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/dashboard/deployments/${h.id}`}
                    className="flex items-center justify-between gap-2 px-5 py-2.5 transition-colors hover:bg-background-subtle"
                    aria-current={h.id === deployment.id ? "page" : undefined}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-xs text-foreground">{h.commit_sha ? shortSha(h.commit_sha) : h.id.slice(0, 7)}</span>
                      {h.id === deployment.id && <Badge tone="accent">Current</Badge>}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-soft">{timeAgo(h.created_at)}</span>
                      <StatusBadge status={h.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
