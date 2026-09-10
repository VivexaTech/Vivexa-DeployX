"use client";

import { Badge, statusTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { formatDateTime } from "@/lib/utils";

export default function DeploymentsPage() {
  const { data, loading } = useDashboardData();
  if (loading || !data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Deployments</h1>
      {data.deployments.length === 0 ? (
        <EmptyState
          title="No deployments yet"
          description="Once you deploy a repository, history, status, and URLs appear here."
          actionHref="/dashboard/projects/new"
          actionLabel="Deploy now"
        />
      ) : (
        <div className="space-y-3">
          {data.deployments.map((item) => (
            <Card key={item.deploymentId} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{item.projectId}</p>
                  <p className="text-sm text-muted">
                    {item.branch} · {item.commitSha?.slice(0, 7) ?? "no commit"} · {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
