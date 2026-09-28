import Link from "next/link";
import { GitBranch, GitCommitHorizontal } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { shortSha, timeAgo } from "@/lib/utils";
import type { Deployment } from "@/types/database";

export type DeploymentWithProject = Deployment & { project: { id: string; name: string } | null };

export function DeploymentsTable({ deployments, showProject = true }: { deployments: DeploymentWithProject[]; showProject?: boolean }) {
  return (
    <Table>
      <THead>
        <tr>
          {showProject && <TH>Project</TH>}
          <TH>Status</TH>
          <TH>Branch</TH>
          <TH>Commit</TH>
          <TH className="text-right">Time</TH>
        </tr>
      </THead>
      <TBody>
        {deployments.map((d) => (
          <TR key={d.id} className="relative">
            {showProject && (
              <TD>
                <Link href={`/dashboard/deployments/${d.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                  {d.project?.name ?? "—"}
                </Link>
              </TD>
            )}
            <TD>
              {showProject ? (
                <StatusBadge status={d.status} />
              ) : (
                <Link href={`/dashboard/deployments/${d.id}`} className="after:absolute after:inset-0">
                  <StatusBadge status={d.status} />
                </Link>
              )}
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
            <TD className="text-right text-muted">{timeAgo(d.created_at)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
