"use client";

import Link from "next/link";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlanLimitCard } from "@/components/dashboard/plan-limit";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { data, loading, error } = useDashboardData();
  if (loading) return <Skeleton className="h-80" />;
  if (error || !data) return <p className="text-danger">{error ?? "Unable to load overview."}</p>;

  const used = data.user.websiteCount;
  const limit = data.user.websiteLimit;
  const nearLimit = limit > 0 && used / limit >= 0.8;
  const atLimit = limit > 0 && used >= limit;
  const progress = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-muted">Overview</p>
          <h1 className="text-3xl font-semibold">Welcome back, {data.user.name.split(" ")[0]}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/projects/new">
            <Button>Quick Deploy</Button>
          </Link>
          <Link href="/dashboard/billing">
            <Button variant="secondary">Upgrade</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted">Current plan</p>
          <p className="mt-2 text-2xl font-semibold">{data.user.activePlanName ?? "No plan"}</p>
          <Badge className="mt-3" tone={statusTone(data.user.subscriptionStatus)}>
            {data.user.subscriptionStatus}
          </Badge>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Website usage</p>
          <p className="mt-2 text-2xl font-semibold">
            {used} / {limit} websites used
          </p>
          <div className="mt-4 h-2 rounded-full bg-accent-soft">
            <div className="h-2 rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Renewal</p>
          <p className="mt-2 text-2xl font-semibold">{formatDate(data.user.renewalDate)}</p>
          <p className="mt-2 text-sm text-muted">
            {data.eligible ? "Eligible to deploy" : "Billing needs attention"}
          </p>
        </Card>
      </div>

      {atLimit ? (
        <PlanLimitCard used={used} limit={limit} planName={data.user.activePlanName ?? undefined} />
      ) : nearLimit ? (
        <Card className="p-5">
          <p className="text-sm">
            You&apos;re approaching your {data.user.activePlanName ?? "plan"} website limit. Upgrade when you need more
            room.
          </p>
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent deployments</h2>
          <Link href="/dashboard/deployments" className="text-sm text-accent">
            View all
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {data.deployments.length === 0 ? (
            <p className="text-sm text-muted">No deployments yet.</p>
          ) : (
            data.deployments.map((item) => (
              <div key={item.deploymentId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
                <div>
                  <p className="font-medium">{item.branch}</p>
                  <p className="text-xs text-muted">{item.commitMessage ?? item.deploymentId}</p>
                </div>
                <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
