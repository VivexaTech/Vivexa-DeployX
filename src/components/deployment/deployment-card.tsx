import Link from "next/link";
import { GitBranch, GitCommitHorizontal } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { shortSha, timeAgo } from "@/lib/utils";
import type { Deployment } from "@/types/database";

/** Compact deployment summary for mobile lists and sidebars. */
export function DeploymentCard({ deployment, projectName }: { deployment: Deployment; projectName?: string }) {
  return (
    <Link
      href={`/dashboard/deployments/${deployment.id}`}
      className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium text-foreground">{projectName ?? deployment.id.slice(0, 8)}</p>
        <StatusBadge status={deployment.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1">
          <GitBranch className="h-3.5 w-3.5" /> {deployment.branch ?? "—"}
        </span>
        <span className="flex items-center gap-1 font-mono">
          <GitCommitHorizontal className="h-3.5 w-3.5" /> {shortSha(deployment.commit_sha)}
        </span>
        <span className="ml-auto text-muted-soft">{timeAgo(deployment.created_at)}</span>
      </div>
    </Link>
  );
}
