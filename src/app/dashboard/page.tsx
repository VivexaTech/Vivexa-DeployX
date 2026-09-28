import { CreditCard, FolderGit2, Globe, Plus, Rocket, Sparkles } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState, Alert } from "@/components/ui/states";
import { GithubIcon } from "@/components/ui/icons";
import { DeploymentsTable, type DeploymentWithProject } from "@/components/deployment/deployments-table";
import { DeploymentCard } from "@/components/deployment/deployment-card";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveSubscription } from "@/lib/data/subscriptions";
import { formatDate } from "@/lib/utils";

export default async function DashboardOverview({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const user = await requireUser();
  const { password } = await searchParams;
  const supabase = await createClient();

  const [projects, active, domains, recent, github, effective] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("deployments").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["queued", "building"]),
    supabase.from("domains").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("deployments")
      .select("*, project:projects(id, name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("github_connections").select("username").eq("user_id", user.id).maybeSingle(),
    getEffectiveSubscription(user.id),
  ]);

  const deployments = (recent.data as DeploymentWithProject[]) ?? [];
  const firstName = user.profile.name?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Overview"}
        description="Here's what's happening across your projects."
        actions={
          <ButtonLink href="/dashboard/projects/new">
            <Plus className="h-4 w-4" /> New Project
          </ButtonLink>
        }
      />

      {password === "updated" && (
        <Alert tone="success" className="mb-6">
          Your password has been updated.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Projects" value={projects.count ?? 0} icon={<FolderGit2 className="h-4 w-4" />} hint={limitHint(projects.count, effective.plan?.max_projects)} />
        <StatCard label="Active Deployments" value={active.count ?? 0} icon={<Rocket className="h-4 w-4" />} hint="Queued or building" />
        <StatCard label="Domains" value={domains.count ?? 0} icon={<Globe className="h-4 w-4" />} hint={limitHint(domains.count, effective.plan?.max_domains)} />
        <StatCard
          label="Current Plan"
          value={effective.plan?.name ?? "None"}
          icon={<CreditCard className="h-4 w-4" />}
          hint={
            effective.subscription?.current_period_end
              ? `Renews by ${formatDate(effective.subscription.current_period_end)}`
              : effective.isFallback
                ? "Default plan"
                : "No expiry"
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader
            title="Recent deployments"
            action={
              <Link href="/dashboard/deployments" className="text-xs text-muted hover:text-foreground">
                View all
              </Link>
            }
          />
          {deployments.length === 0 ? (
            <EmptyState
              icon={<Rocket className="h-5 w-5" />}
              title="No deployments yet"
              description="Import a repository to create your first deployment."
              action={
                <ButtonLink href="/dashboard/projects/new" size="sm">
                  <Plus className="h-4 w-4" /> New Project
                </ButtonLink>
              }
            />
          ) : (
            <>
              <div className="hidden md:block">
                <DeploymentsTable deployments={deployments} />
              </div>
              <div className="space-y-2 p-3 md:hidden">
                {deployments.map((d) => (
                  <DeploymentCard key={d.id} deployment={d} projectName={d.project?.name} />
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Quick actions" />
          <div className="grid gap-1 p-2">
            <QuickAction href="/dashboard/projects/new" icon={<Plus className="h-4 w-4" />} label="New Project" />
            <QuickAction
              href={github.data ? "/dashboard/settings#github" : "/api/github/connect"}
              icon={<GithubIcon className="h-4 w-4" />}
              label={github.data ? `GitHub: @${(github.data as { username: string }).username}` : "Connect GitHub"}
              prefetch={Boolean(github.data)}
            />
            <QuickAction href="/dashboard/domains?add=1" icon={<Globe className="h-4 w-4" />} label="Add Domain" />
            <QuickAction href="/dashboard/billing" icon={<Sparkles className="h-4 w-4" />} label="Upgrade Plan" />
          </div>
        </Card>
      </div>
    </>
  );
}

function limitHint(count: number | null, limit: number | null | undefined) {
  if (limit === undefined) return undefined;
  return limit === null ? "Unlimited on your plan" : `${count ?? 0} of ${limit} used`;
}

function QuickAction({ href, icon, label, prefetch = true }: { href: string; icon: React.ReactNode; label: string; prefetch?: boolean }) {
  const className =
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-muted transition-colors hover:bg-background-subtle hover:text-foreground";
  if (!prefetch) {
    return (
      <a href={href} className={className}>
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background-subtle text-foreground">{icon}</span>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background-subtle text-foreground">{icon}</span>
      {label}
    </Link>
  );
}
