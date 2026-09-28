import type { Metadata } from "next";
import { Activity, CheckCircle2, Clock, Rocket } from "lucide-react";
import { Card, CardContent, CardHeader, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { BarChart } from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { bucketByDay, daysAgo } from "@/lib/utils/charts";
import type { DeploymentStatus } from "@/types/database";

export const metadata: Metadata = { title: "Analytics" };

type Row = {
  status: DeploymentStatus;
  created_at: string;
  build_started_at: string | null;
  ready_at: string | null;
  project: { name: string } | null;
};

export default async function AnalyticsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const since = daysAgo(29);

  const { data } = await supabase
    .from("deployments")
    .select("status, created_at, build_started_at, ready_at, project:projects(name)")
    .eq("user_id", user.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .limit(5000);
  const rows = (data as unknown as Row[]) ?? [];

  const total = rows.length;
  const finished = rows.filter((r) => r.status === "ready" || r.status === "error");
  const succeeded = rows.filter((r) => r.status === "ready");
  const successRate = finished.length ? Math.round((succeeded.length / finished.length) * 100) : null;
  const durations = succeeded
    .filter((r) => r.ready_at)
    .map((r) => new Date(r.ready_at as string).getTime() - new Date(r.build_started_at ?? r.created_at).getTime())
    .filter((ms) => ms > 0);
  const avgBuild = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000) : null;

  const perDay = bucketByDay(rows, 30, (r) => r.created_at);
  const failuresPerDay = bucketByDay(
    rows.filter((r) => r.status === "error"),
    30,
    (r) => r.created_at,
  );

  const byProject = new Map<string, number>();
  for (const r of rows) {
    const name = r.project?.name ?? "Deleted project";
    byProject.set(name, (byProject.get(name) ?? 0) + 1);
  }
  const projectBreakdown = [...byProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const statusCounts = (["ready", "building", "queued", "error", "cancelled"] as DeploymentStatus[]).map((s) => ({
    status: s,
    count: rows.filter((r) => r.status === s).length,
  }));

  return (
    <>
      <PageHeader title="Analytics" description="Deployment activity over the last 30 days." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Deployments" value={total} icon={<Rocket className="h-4 w-4" />} hint="Last 30 days" />
        <StatCard label="Success Rate" value={successRate === null ? "—" : `${successRate}%`} icon={<CheckCircle2 className="h-4 w-4" />} hint="Of finished builds" />
        <StatCard
          label="Avg. Build Time"
          value={avgBuild === null ? "—" : avgBuild >= 60 ? `${Math.floor(avgBuild / 60)}m ${avgBuild % 60}s` : `${avgBuild}s`}
          icon={<Clock className="h-4 w-4" />}
          hint="Successful builds"
        />
        <StatCard label="Active Projects" value={byProject.size} icon={<Activity className="h-4 w-4" />} hint="Deployed this period" />
      </div>

      {total === 0 ? (
        <Card className="mt-6">
          <EmptyState icon={<Activity className="h-5 w-5" />} title="No activity yet" description="Analytics appear once you start deploying projects." />
        </Card>
      ) : (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Deployments per day" />
              <CardContent>
                <BarChart data={perDay} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Failed deployments per day" />
              <CardContent>
                <BarChart data={failuresPerDay} tone="danger" />
              </CardContent>
            </Card>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Deployments by project" />
              <CardContent className="space-y-3">
                {projectBreakdown.map(([name, count]) => (
                  <div key={name}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="truncate text-foreground">{name}</span>
                      <span className="text-muted">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-background-subtle">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (count / total) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Status breakdown" />
              <CardContent>
                <ul className="divide-y divide-border">
                  {statusCounts.map(({ status, count }) => (
                    <li key={status} className="flex items-center justify-between py-2.5">
                      <StatusBadge status={status} />
                      <span className="text-sm font-medium text-foreground">{count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      <p className="mt-6 text-xs text-muted-soft">Visitor and bandwidth analytics are not available yet. Figures above are based on DeployX deployment records.</p>
    </>
  );
}
