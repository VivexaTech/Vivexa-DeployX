import Link from "next/link";
import { ExternalLink, GitBranch } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { GithubIcon } from "@/components/ui/icons";
import { getFramework } from "@/lib/frameworks";
import { timeAgo } from "@/lib/utils";
import type { Project } from "@/types/database";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background-subtle font-mono text-sm font-semibold text-foreground">
            {project.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <Link href={`/dashboard/projects/${project.id}`} className="block truncate text-sm font-semibold text-foreground after:absolute after:inset-0">
              {project.name}
            </Link>
            {project.production_url ? (
              <a
                href={project.production_url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-10 flex items-center gap-1 truncate text-xs text-muted hover:text-foreground"
              >
                {project.production_url.replace(/^https?:\/\//, "")}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : (
              <p className="text-xs text-muted-soft">No production URL yet</p>
            )}
          </div>
        </div>
        <StatusBadge status={project.latest_deployment_status} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <GithubIcon className="h-3.5 w-3.5" />
          {project.repo_owner}/{project.repo_name}
        </span>
        <span className="flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5" />
          {project.branch}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-soft">
        <span>{getFramework(project.framework).name}</span>
        <span>{project.last_deployed_at ? `Deployed ${timeAgo(project.last_deployed_at)}` : `Created ${timeAgo(project.created_at)}`}</span>
      </div>
    </div>
  );
}
