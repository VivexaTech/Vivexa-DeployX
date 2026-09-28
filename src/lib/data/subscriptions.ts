import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanBySlug } from "@/lib/data/plans";
import { getPlatformSettings } from "@/lib/data/settings";
import { createNotification } from "@/lib/data/notifications";
import type { BillingCycle, Plan, Subscription } from "@/types/database";

export type EffectiveSubscription = {
  subscription: Subscription | null;
  plan: Plan | null;
  isFallback: boolean;
};

/**
 * Returns the user's effective plan. Expired paid subscriptions are marked
 * expired lazily and the user falls back to the default (free) plan.
 */
export async function getEffectiveSubscription(userId: string): Promise<EffectiveSubscription> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("*, plan:plans(*)")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  const row = data as (Subscription & { plan: Plan }) | null;

  if (row && row.current_period_end && new Date(row.current_period_end).getTime() < Date.now()) {
    await admin.from("subscriptions").update({ status: "expired" }).eq("id", row.id).eq("status", "active");
    await createNotification(userId, {
      type: "subscription_expired",
      title: "Your subscription has expired",
      body: `Your ${row.plan?.name ?? ""} plan period ended. Renew to restore your plan limits.`,
      link: "/dashboard/billing",
    });
  } else if (row) {
    const { plan, ...subscription } = row;
    return { subscription, plan, isFallback: false };
  }

  const settings = await getPlatformSettings();
  const fallback = await getPlanBySlug(settings.default_plan_slug);
  return { subscription: null, plan: fallback, isFallback: true };
}

/** Activates the free plan for a user (no payment required). */
export async function activateFreePlan(userId: string, plan: Plan): Promise<void> {
  if (plan.price_monthly !== 0 || plan.price_yearly !== 0) {
    throw new Error("Plan is not free");
  }
  const admin = createAdminClient();
  await admin.from("subscriptions").update({ status: "cancelled" }).eq("user_id", userId).eq("status", "active");
  const { error } = await admin.from("subscriptions").insert({
    user_id: userId,
    plan_id: plan.id,
    status: "active",
    billing_cycle: "free",
    current_period_start: new Date().toISOString(),
    current_period_end: null,
  });
  if (error) throw error;
}

export function periodEnd(start: Date, cycle: BillingCycle): Date | null {
  if (cycle === "free") return null;
  const end = new Date(start);
  if (cycle === "monthly") end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  return end;
}
