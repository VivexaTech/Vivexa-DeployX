import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveSubscription } from "@/lib/data/subscriptions";
import { createNotification } from "@/lib/data/notifications";
import { PublicError } from "@/lib/utils/sanitize";
import type { Plan } from "@/types/database";

export type LimitKind = "projects" | "deployments" | "domains";

export type UsageSnapshot = {
  plan: Plan | null;
  projects: number;
  domains: number;
  deploymentsThisMonth: number;
};

export function monthStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function getUsageSnapshot(userId: string): Promise<UsageSnapshot> {
  const admin = createAdminClient();
  const [{ plan }, projects, domains, deployments] = await Promise.all([
    getEffectiveSubscription(userId),
    admin.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("domains").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin
      .from("deployments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart().toISOString()),
  ]);
  return {
    plan,
    projects: projects.count ?? 0,
    domains: domains.count ?? 0,
    deploymentsThisMonth: deployments.count ?? 0,
  };
}

const LIMIT_LABEL: Record<LimitKind, string> = {
  projects: "projects",
  deployments: "deployments this month",
  domains: "domains",
};

/**
 * Server-side plan limit enforcement. Throws a PublicError with an upgrade
 * message when the limit is reached.
 */
export async function assertWithinLimit(userId: string, kind: LimitKind): Promise<void> {
  const usage = await getUsageSnapshot(userId);
  if (!usage.plan) {
    throw new PublicError("No active plan found. Choose a plan from Billing to continue.", 402);
  }
  const limit =
    kind === "projects"
      ? usage.plan.max_projects
      : kind === "domains"
        ? usage.plan.max_domains
        : usage.plan.max_deployments_per_month;
  const current = kind === "projects" ? usage.projects : kind === "domains" ? usage.domains : usage.deploymentsThisMonth;

  if (limit !== null && current >= limit) {
    await createNotification(userId, {
      type: "limit_reached",
      title: "Plan limit reached",
      body: `You have used ${current} of ${limit} ${LIMIT_LABEL[kind]} on the ${usage.plan.name} plan.`,
      link: "/dashboard/billing",
    });
    throw new PublicError(
      `You've reached your ${usage.plan.name} plan limit of ${limit} ${LIMIT_LABEL[kind]}. Upgrade your plan to continue.`,
      402,
    );
  }
}

export async function incrementUsage(userId: string, field: "deployments_count" | "builds_count"): Promise<void> {
  const admin = createAdminClient();
  const period = monthStart().toISOString().slice(0, 10);
  const { data } = await admin
    .from("usage")
    .select("id, deployments_count, builds_count")
    .eq("user_id", userId)
    .eq("period_start", period)
    .maybeSingle();
  if (data) {
    const row = data as { id: string; deployments_count: number; builds_count: number };
    await admin.from("usage").update({ [field]: row[field] + 1 }).eq("id", row.id);
  } else {
    await admin.from("usage").insert({ user_id: userId, period_start: period, [field]: 1 });
  }
}
