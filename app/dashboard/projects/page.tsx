"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/hooks/use-dashboard-data";

function ProjectsList() {
  const { data, loading, error } = useDashboardData();
  const params = useSearchParams();
  const query = (params.get("q") ?? "").toLowerCase();
  if (loading) return <Skeleton className="h-64" />;
  if (error || !data) return <p className="text-danger">{error}</p>;
  const projects = data.projects.filter((project) => project.name.toLowerCase().includes(query));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Projects</h1>
          <p className="text-sm text-muted">
            {data.user.websiteCount} / {data.user.websiteLimit} websites used
          </p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button>New project</Button>
        </Link>
      </div>
      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Connect GitHub and deploy your first repository. Plan limits are checked before anything goes live."
          actionHref="/dashboard/projects/new"
          actionLabel="Deploy a project"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.projectId} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{project.name}</h2>
                  <p className="mt-1 text-sm text-muted">{project.repository}</p>
                </div>
                <Badge tone={statusTone(project.status)}>{project.status}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted">{project.deploymentUrl ?? "No live URL yet"}</p>
              <Link href={`/dashboard/projects/${project.projectId}`} className="mt-4 inline-flex">
                <Button size="sm" variant="secondary">
                  View project
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ProjectsList />
    </Suspense>
  );
}
