import Link from "next/link";
import { GitBranch, GitCommitHorizontal, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { RollbackButton } from "@/components/deployment/rollback-button";
import { shortSha, timeAgo } from "@/lib/utils";
import type { Deployment } from "@/types/database";

export type DeploymentWithProject = Deployment & { project: { id: string; name: string } | null };

export function DeploymentsTable({
  deployments,
  showProject = true,
  productionDeploymentId,
}: {
  deployments: DeploymentWithProject[];
  showProject?: boolean;
  productionDeploymentId?: string | null;
}) {
  return (
    <Table>
      <THead>
        <tr>
          {showProject && <TH>Project</TH>}
          <TH>Status</TH>
          <TH>Branch</TH>
          <TH>Commit</TH>
          <TH>Environment</TH>
          <TH className="text-right">Time</TH>
          <TH className="text-right">Actions</TH>
        </tr>
      </THead>
      <TBody>
        {deployments.map((d) => {
          const isProd = d.id === productionDeploymentId || (d.status === "ready" && !productionDeploymentId && deployments[0]?.id === d.id);
          return (
            <TR key={d.id} className="relative group">
              {showProject && (
                <TD>
                  <Link href={`/dashboard/deployments/${d.id}`} className="font-medium hover:underline">
                    {d.project?.name ?? "—"}
                  </Link>
                </TD>
              )}
              <TD>
                <Link href={`/dashboard/deployments/${d.id}`}>
                  <StatusBadge status={d.status} />
                </Link>
              </TD>
              <TD>
                <span className="flex items-center gap-1.5 text-muted">
                  <GitBranch className="h-3.5 w-3.5" />
                  {d.branch ?? "—"}
                </span>
              </TD>
              <TD className="max-w-72">
                <span className="flex items-center gap-1.5 text-muted">
                  <GitCommitHorizontal className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-mono text-xs">{shortSha(d.commit_sha)}</span>
                  {d.commit_message && <span className="truncate">{d.commit_message}</span>}
                </span>
              </TD>
              <TD>
                {isProd ? (
                  <Badge tone="accent" dot>
                    Production
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-soft capitalize">{d.target || "preview"}</span>
                )}
              </TD>
              <TD className="text-right text-muted">{timeAgo(d.created_at)}</TD>
              <TD className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Link
                    href={`/dashboard/deployments/${d.id}`}
                    className="inline-flex items-center gap-1 rounded p-1 text-xs text-muted hover:bg-background-subtle hover:text-foreground"
                    title="View Build Logs"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                  </Link>
                  <RollbackButton
                    projectId={d.project_id}
                    deploymentId={d.id}
                    commitSha={d.commit_sha}
                    isCurrentProduction={isProd}
                  />
                </div>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
