import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, FolderGit2, IndianRupee, LifeBuoy, Rocket, Users } from "lucide-react";
import { Card, CardContent, CardHeader, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { AreaChart, BarChart } from "@/components/ui/chart";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { bucketByDay, daysAgo } from "@/lib/utils/charts";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { getIntegrationStatus } from "@/lib/env";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  await requireAdmin();
  const db = createAdminClient();
  const since = daysAgo(29).toISOString();

  const [users, activeSubs, projects, deploymentsMonth, openTickets, revenueRows, signupRows, deployRows, recentPayments, recentUsers] =
    await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("subscriptions").select("id, billing_cycle", { count: "exact" }).eq("status", "active").neq("billing_cycle", "free"),
      db.from("projects").select("id", { count: "exact", head: true }),
      db.from("deployments").select("id", { count: "exact", head: true }).gte("created_at", since),
      db.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
      db.from("payments").select("amount, created_at").eq("status", "paid").gte("created_at", since),
      db.from("profiles").select("created_at").gte("created_at", since),
      db.from("deployments").select("status, created_at").gte("created_at", since).limit(10_000),
      db.from("payments").select("id, amount, currency, status, created_at, profile:profiles(email)").order("created_at", { ascending: false }).limit(6),
      db.from("profiles").select("id, email, name, created_at").order("created_at", { ascending: false }).limit(6),
    ]);

  const revenue = (revenueRows.data as { amount: number; created_at: string }[]) ?? [];
  const revenueTotal = revenue.reduce((sum, r) => sum + r.amount, 0);
  const deploys = (deployRows.data as { status: string; created_at: string }[]) ?? [];
  const failed = deploys.filter((d) => d.status === "error").length;
  const payments = (recentPayments.data as unknown as { id: string; amount: number; currency: string; status: string; created_at: string; profile: { email: string } | null }[]) ?? [];
  const latestUsers = (recentUsers.data as { id: string; email: string; name: string | null; created_at: string }[]) ?? [];
  const status = getIntegrationStatus();

  return (
    <>
      <PageHeader title="Admin Dashboard" description="Platform health and business metrics for the last 30 days." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Users" value={users.count ?? 0} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Paid Subscriptions" value={activeSubs.count ?? 0} icon={<CreditCard className="h-4 w-4" />} />
        <StatCard label="Revenue (30d)" value={formatCurrency(revenueTotal)} icon={<IndianRupee className="h-4 w-4" />} />
        <StatCard label="Projects" value={projects.count ?? 0} icon={<FolderGit2 className="h-4 w-4" />} />
        <StatCard
          label="Deployments (30d)"
          value={deploymentsMonth.count ?? 0}
          icon={<Rocket className="h-4 w-4" />}
          hint={deploys.length ? `${Math.round((failed / deploys.length) * 100)}% failed` : undefined}
        />
        <StatCard label="Open Tickets" value={openTickets.count ?? 0} icon={<LifeBuoy className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue" description="Verified payments per day" />
          <CardContent>
            <AreaChart data={bucketByDay(revenue, 30, (r) => r.created_at, (r) => r.amount / 100)} format={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Signups" description="New accounts per day" />
          <CardContent>
            <BarChart data={bucketByDay((signupRows.data as { created_at: string }[]) ?? [], 30, (r) => r.created_at)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Deployments" description="All deployments per day" />
          <CardContent>
            <BarChart data={bucketByDay(deploys, 30, (d) => d.created_at)} tone="success" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Integrations" description="Server configuration status" />
          <CardContent>
            <ul className="divide-y divide-border">
              {(
                [
                  ["Supabase", status.supabase],
                  ["GitHub OAuth", status.github],
                  ["Deployment Engine", status.vercel],
                  ["Razorpay", status.razorpay],
                  ["Encryption key", status.encryption],
                ] as const
              ).map(([label, ok]) => (
                <li key={label} className="flex items-center justify-between py-2.5 text-[13px]">
                  <span className="text-foreground">{label}</span>
                  <span className={ok ? "text-success" : "text-warning"}>{ok ? "Configured" : "Not configured"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader
            title="Recent payments"
            action={
              <Link href="/admin/payments" className="text-xs text-muted hover:text-foreground">
                View all
              </Link>
            }
          />
          {payments.length === 0 ? (
            <EmptyState title="No payments yet" className="py-10" />
          ) : (
            <ul className="divide-y divide-border">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-foreground">{p.profile?.email ?? "—"}</p>
                    <p className="text-xs text-muted">{timeAgo(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-medium">{formatCurrency(p.amount, p.currency)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="overflow-hidden">
          <CardHeader
            title="Newest users"
            action={
              <Link href="/admin/users" className="text-xs text-muted hover:text-foreground">
                View all
              </Link>
            }
          />
          {latestUsers.length === 0 ? (
            <EmptyState title="No users yet" className="py-10" />
          ) : (
            <ul className="divide-y divide-border">
              {latestUsers.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/users/${u.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-background-subtle">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-foreground">{u.name ?? u.email}</p>
                      <p className="truncate text-xs text-muted">{u.email}</p>
                    </div>
                    <span className="text-xs text-muted-soft">{timeAgo(u.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
