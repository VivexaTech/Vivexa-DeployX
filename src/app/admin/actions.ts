"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/data/audit";
import { createNotification } from "@/lib/data/notifications";
import { GENERAL_SETTING_KEYS, PUBLIC_SETTING_KEYS, type PlatformSettings } from "@/lib/data/settings";
import { isValidGstin, normalizeGstin, normalizeStateCode } from "@/lib/billing/tax";
import { periodEnd } from "@/lib/data/subscriptions";
import { canChangeRole, canSuspend, isSuperAdmin } from "@/lib/permissions";
import { rateLimit } from "@/lib/security/rate-limit";
import type { Plan, Profile, UserRole } from "@/types/database";

export type AdminActionState = { error?: string; message?: string; ok?: boolean } | undefined;

const uuid = z.string().uuid();

function fail(error: string): AdminActionState {
  return { error };
}

function firstIssue(error: z.ZodError): AdminActionState {
  return fail(error.issues[0]?.message ?? "Invalid input");
}

/** Optional integer limit: empty string = unlimited (null). */
const limitField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Limits must be whole numbers (leave empty for unlimited)" });
      return z.NEVER;
    }
    return n;
  });

/** Rupees in the form → paise in the database. */
const rupeesField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = Number(v || "0");
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Prices must be positive numbers" });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

async function loadTarget(userId: string): Promise<Profile | null> {
  const { data } = await createAdminClient().from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function changeRoleAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ userId: uuid, role: z.enum(["user", "admin", "super_admin"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  const target = await loadTarget(parsed.data.userId);
  if (!target) return fail("User not found.");
  if (!canChangeRole(admin.profile.role, admin.id, target.id, parsed.data.role as UserRole)) {
    return fail("Only super admins can change roles, and you cannot change your own role.");
  }
  if (target.role === parsed.data.role) return { message: "Role unchanged." };

  const { error } = await createAdminClient().from("profiles").update({ role: parsed.data.role }).eq("id", target.id);
  if (error) return fail("Could not update the role.");
  await recordAudit(admin.id, "ROLE_CHANGED", "user", target.id, { from: target.role, to: parsed.data.role, email: target.email });
  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath("/admin/users");
  return { ok: true, message: "Role updated." };
}

export async function setUserStatusAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ userId: uuid, status: z.enum(["active", "suspended"]), reason: z.string().trim().max(500).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  const target = await loadTarget(parsed.data.userId);
  if (!target) return fail("User not found.");
  if (!canSuspend(admin.profile.role, admin.id, target.id, target.role)) {
    return fail("You don't have permission to change this account's status.");
  }

  const { error } = await createAdminClient().from("profiles").update({ status: parsed.data.status }).eq("id", target.id);
  if (error) return fail("Could not update the account status.");
  await recordAudit(admin.id, parsed.data.status === "suspended" ? "USER_SUSPENDED" : "USER_REACTIVATED", "user", target.id, {
    email: target.email,
    reason: parsed.data.reason ?? null,
  });
  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath("/admin/users");
  return { ok: true, message: parsed.data.status === "suspended" ? "User suspended." : "User reactivated." };
}

export async function assignPlanAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      userId: uuid,
      planId: uuid,
      cycle: z.enum(["free", "monthly", "yearly"]),
      note: z.string().trim().min(3, "Add a short reason for the audit log").max(500),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  const db = createAdminClient();
  const [target, { data: planData }] = await Promise.all([
    loadTarget(parsed.data.userId),
    db.from("plans").select("*").eq("id", parsed.data.planId).maybeSingle(),
  ]);
  if (!target) return fail("User not found.");
  const plan = planData as Plan | null;
  if (!plan) return fail("Plan not found.");

  const start = new Date();
  await db.from("subscriptions").update({ status: "cancelled" }).eq("user_id", target.id).eq("status", "active");
  const { data: sub, error } = await db
    .from("subscriptions")
    .insert({
      user_id: target.id,
      plan_id: plan.id,
      status: "active",
      billing_cycle: parsed.data.cycle,
      current_period_start: start.toISOString(),
      current_period_end: periodEnd(start, parsed.data.cycle)?.toISOString() ?? null,
    })
    .select("id")
    .single();
  if (error || !sub) return fail("Could not assign the plan.");

  await recordAudit(admin.id, "SUBSCRIPTION_UPDATED", "subscription", (sub as { id: string }).id, {
    action: "assigned",
    user_id: target.id,
    plan: plan.slug,
    cycle: parsed.data.cycle,
    note: parsed.data.note,
  });
  await createNotification(target.id, {
    type: "announcement",
    title: "Your plan was updated",
    body: `Your account is now on the ${plan.name} plan.`,
    link: "/dashboard/billing",
  });
  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath("/admin/subscriptions");
  return { ok: true, message: `Assigned ${plan.name}.` };
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export async function updateSubscriptionAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      subscriptionId: uuid,
      op: z.enum(["cancel", "extend"]),
      days: z.coerce.number().int().min(1).max(3650).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  const db = createAdminClient();
  const { data } = await db.from("subscriptions").select("*").eq("id", parsed.data.subscriptionId).maybeSingle();
  const sub = data as { id: string; user_id: string; status: string; current_period_end: string | null } | null;
  if (!sub) return fail("Subscription not found.");

  if (parsed.data.op === "cancel") {
    if (sub.status !== "active") return fail("Only active subscriptions can be cancelled.");
    await db.from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id);
    await recordAudit(admin.id, "SUBSCRIPTION_UPDATED", "subscription", sub.id, { action: "cancelled", user_id: sub.user_id });
    await createNotification(sub.user_id, {
      type: "announcement",
      title: "Your subscription was cancelled",
      body: "Your account has returned to the default plan. Contact support if you have questions.",
      link: "/dashboard/billing",
    });
  } else {
    if (!parsed.data.days) return fail("Enter the number of days to extend.");
    if (!sub.current_period_end) return fail("This subscription has no expiry to extend.");
    const base = new Date(Math.max(Date.now(), new Date(sub.current_period_end).getTime()));
    base.setDate(base.getDate() + parsed.data.days);
    await db.from("subscriptions").update({ current_period_end: base.toISOString(), status: "active" }).eq("id", sub.id);
    await recordAudit(admin.id, "SUBSCRIPTION_UPDATED", "subscription", sub.id, {
      action: "extended",
      days: parsed.data.days,
      new_period_end: base.toISOString(),
      user_id: sub.user_id,
    });
  }
  revalidatePath("/admin/subscriptions");
  revalidatePath(`/admin/users/${sub.user_id}`);
  return { ok: true, message: parsed.data.op === "cancel" ? "Subscription cancelled." : "Subscription extended." };
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

const planSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, "Slug may contain lowercase letters, numbers and hyphens"),
  description: z.string().trim().max(300).default(""),
  priceMonthly: rupeesField,
  priceYearly: rupeesField,
  features: z.string().max(4000).default(""),
  maxProjects: limitField,
  maxDeployments: limitField,
  maxDomains: limitField,
  maxTeamMembers: limitField,
  bandwidthGb: limitField,
  maxBuilds: limitField,
  displayOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: z.string().optional(),
  isFeatured: z.string().optional(),
});

export async function savePlanAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);
  const p = parsed.data;

  const row = {
    name: p.name,
    slug: p.slug,
    description: p.description,
    price_monthly: p.priceMonthly,
    price_yearly: p.priceYearly,
    features: p.features
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, 30),
    max_projects: p.maxProjects,
    max_deployments_per_month: p.maxDeployments,
    max_domains: p.maxDomains,
    max_team_members: p.maxTeamMembers,
    bandwidth_gb: p.bandwidthGb,
    max_builds_per_month: p.maxBuilds,
    display_order: p.displayOrder,
    is_active: p.isActive === "on",
    is_featured: p.isFeatured === "on",
  };

  const db = createAdminClient();
  if (p.id) {
    const { data: before } = await db.from("plans").select("*").eq("id", p.id).maybeSingle();
    if (!before) return fail("Plan not found.");
    const { error } = await db.from("plans").update(row).eq("id", p.id);
    if (error) return fail(error.code === "23505" ? "Another plan already uses this slug." : "Could not update the plan.");
    await recordAudit(admin.id, "PLAN_UPDATED", "plan", p.id, { before, after: row });
  } else {
    const { data, error } = await db.from("plans").insert(row).select("id").single();
    if (error || !data) return fail(error?.code === "23505" ? "Another plan already uses this slug." : "Could not create the plan.");
    await recordAudit(admin.id, "PLAN_CREATED", "plan", (data as { id: string }).id, row);
  }
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  revalidatePath("/");
  return { ok: true, message: p.id ? "Plan updated." : "Plan created." };
}

export async function togglePlanAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = z.object({ planId: uuid, active: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);
  const active = parsed.data.active === "true";
  const { error } = await createAdminClient().from("plans").update({ is_active: active }).eq("id", parsed.data.planId);
  if (error) return fail("Could not update the plan.");
  await recordAudit(admin.id, active ? "PLAN_UPDATED" : "PLAN_DEACTIVATED", "plan", parsed.data.planId, { is_active: active });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return { ok: true, message: active ? "Plan activated." : "Plan deactivated. Existing subscribers keep it until their period ends." };
}

export async function deletePlanAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  if (!isSuperAdmin(admin.profile.role)) return fail("Only super admins can delete plans.");
  const parsed = z.object({ planId: uuid }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  const db = createAdminClient();
  const [subs, payments] = await Promise.all([
    db.from("subscriptions").select("id", { count: "exact", head: true }).eq("plan_id", parsed.data.planId),
    db.from("payments").select("id", { count: "exact", head: true }).eq("plan_id", parsed.data.planId),
  ]);
  if ((subs.count ?? 0) > 0 || (payments.count ?? 0) > 0) {
    return fail("This plan has subscription or payment history and can't be deleted. Deactivate it instead.");
  }
  const { data: plan } = await db.from("plans").select("slug, name").eq("id", parsed.data.planId).maybeSingle();
  const { error } = await db.from("plans").delete().eq("id", parsed.data.planId);
  if (error) return fail("Could not delete the plan.");
  await recordAudit(admin.id, "PLAN_DELETED", "plan", parsed.data.planId, plan ?? {});
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return { ok: true, message: "Plan deleted." };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function reviewPaymentAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      paymentId: uuid,
      note: z.string().trim().min(3, "Add a review note").max(1000),
      markRefunded: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  const db = createAdminClient();
  const { data } = await db.from("payments").select("id, status, metadata, user_id").eq("id", parsed.data.paymentId).maybeSingle();
  const payment = data as { id: string; status: string; metadata: Record<string, unknown>; user_id: string } | null;
  if (!payment) return fail("Payment not found.");

  const refund = parsed.data.markRefunded === "on";
  if (refund && payment.status !== "paid") return fail("Only paid payments can be recorded as refunded.");

  const metadata = {
    ...payment.metadata,
    reviewed_at: new Date().toISOString(),
    reviewed_by: admin.id,
    review_note: parsed.data.note,
    ...(refund ? { refund_recorded_at: new Date().toISOString() } : {}),
  };
  const { error } = await db
    .from("payments")
    .update(refund ? { metadata, status: "refunded" } : { metadata })
    .eq("id", payment.id);
  if (error) return fail("Could not save the review.");
  await recordAudit(admin.id, "PAYMENT_REVIEWED", "payment", payment.id, { note: parsed.data.note, refunded: refund });
  revalidatePath("/admin/payments");
  return { ok: true, message: refund ? "Refund recorded." : "Review saved." };
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

const couponSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("")),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/, "Code may contain letters, numbers, hyphens and underscores"),
    description: z.string().trim().max(200).optional(),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.coerce.number().positive("Discount must be greater than zero"),
    maxRedemptions: limitField,
    validUntil: z.string().trim().optional(),
    isActive: z.string().optional(),
  })
  .refine((v) => v.discountType !== "percent" || v.discountValue <= 100, { message: "Percent discounts cannot exceed 100" });

export async function saveCouponAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = couponSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);
  const c = parsed.data;

  let validUntil: string | null = null;
  if (c.validUntil) {
    const d = new Date(c.validUntil);
    if (Number.isNaN(d.getTime())) return fail("Invalid expiry date.");
    validUntil = d.toISOString();
  }
  const row = {
    code: c.code,
    description: c.description || null,
    discount_type: c.discountType,
    // Fixed discounts are entered in rupees and stored in paise.
    discount_value: c.discountType === "fixed" ? Math.round(c.discountValue * 100) : Math.round(c.discountValue),
    max_redemptions: c.maxRedemptions,
    valid_until: validUntil,
    is_active: c.isActive === "on",
  };

  const db = createAdminClient();
  if (c.id) {
    const { error } = await db.from("coupons").update(row).eq("id", c.id);
    if (error) return fail(error.code === "23505" ? "A coupon with this code already exists." : "Could not update the coupon.");
    await recordAudit(admin.id, "COUPON_UPDATED", "coupon", c.id, row);
  } else {
    const { data, error } = await db.from("coupons").insert(row).select("id").single();
    if (error || !data) return fail(error?.code === "23505" ? "A coupon with this code already exists." : "Could not create the coupon.");
    await recordAudit(admin.id, "COUPON_CREATED", "coupon", (data as { id: string }).id, row);
  }
  revalidatePath("/admin/coupons");
  return { ok: true, message: c.id ? "Coupon updated." : "Coupon created." };
}

export async function toggleCouponAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = z.object({ couponId: uuid, active: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);
  const active = parsed.data.active === "true";
  const { error } = await createAdminClient().from("coupons").update({ is_active: active }).eq("id", parsed.data.couponId);
  if (error) return fail("Could not update the coupon.");
  await recordAudit(admin.id, "COUPON_UPDATED", "coupon", parsed.data.couponId, { is_active: active });
  revalidatePath("/admin/coupons");
  return { ok: true, message: active ? "Coupon activated." : "Coupon deactivated." };
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

export async function adminReplyTicketAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      ticketId: uuid,
      message: z.string().trim().min(1, "Message cannot be empty").max(10_000),
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  const db = createAdminClient();
  const { data } = await db.from("support_tickets").select("id, user_id, subject, status").eq("id", parsed.data.ticketId).maybeSingle();
  const ticket = data as { id: string; user_id: string; subject: string; status: string } | null;
  if (!ticket) return fail("Ticket not found.");

  const { error } = await db
    .from("support_messages")
    .insert({ ticket_id: ticket.id, author_id: admin.id, is_staff: true, message: parsed.data.message });
  if (error) return fail("Could not send the reply.");

  const nextStatus = parsed.data.status ?? (ticket.status === "open" ? "in_progress" : ticket.status);
  await db.from("support_tickets").update({ status: nextStatus }).eq("id", ticket.id);
  await recordAudit(admin.id, "TICKET_REPLIED", "support_ticket", ticket.id, { status: nextStatus });
  await createNotification(ticket.user_id, {
    type: "support_update",
    title: "New reply on your support ticket",
    body: ticket.subject,
    link: `/dashboard/support/${ticket.id}`,
  });
  revalidatePath(`/admin/support/${ticket.id}`);
  revalidatePath("/admin/support");
  return { ok: true, message: "Reply sent." };
}

export async function setTicketStatusAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ ticketId: uuid, status: z.enum(["open", "in_progress", "resolved", "closed"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  const db = createAdminClient();
  const { data } = await db.from("support_tickets").select("id, user_id, subject, status").eq("id", parsed.data.ticketId).maybeSingle();
  const ticket = data as { id: string; user_id: string; subject: string; status: string } | null;
  if (!ticket) return fail("Ticket not found.");
  if (ticket.status === parsed.data.status) return { message: "Status unchanged." };

  await db.from("support_tickets").update({ status: parsed.data.status }).eq("id", ticket.id);
  await recordAudit(admin.id, "TICKET_STATUS_CHANGED", "support_ticket", ticket.id, { from: ticket.status, to: parsed.data.status });
  await createNotification(ticket.user_id, {
    type: "support_update",
    title: `Ticket ${parsed.data.status.replace("_", " ")}`,
    body: ticket.subject,
    link: `/dashboard/support/${ticket.id}`,
  });
  revalidatePath(`/admin/support/${ticket.id}`);
  revalidatePath("/admin/support");
  return { ok: true, message: "Status updated." };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function broadcastNotificationAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  if (!rateLimit(`broadcast:${admin.id}`, 3, 10 * 60_000).ok) return fail("Too many broadcasts. Please wait a few minutes.");
  const parsed = z
    .object({
      title: z.string().trim().min(3).max(120),
      body: z.string().trim().max(1000).optional(),
      link: z
        .string()
        .trim()
        .max(300)
        .refine((v) => v === "" || v.startsWith("/") || /^https:\/\//.test(v), "Link must be a relative path or https URL")
        .optional(),
      audience: z.enum(["all", "admins"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  const db = createAdminClient();
  let query = db.from("profiles").select("id").eq("status", "active");
  if (parsed.data.audience === "admins") query = query.in("role", ["admin", "super_admin"]);
  const { data: recipients } = await query.limit(50_000);
  const ids = ((recipients as { id: string }[]) ?? []).map((r) => r.id);
  if (ids.length === 0) return fail("No recipients match this audience.");

  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500).map((userId) => ({
      user_id: userId,
      type: "announcement",
      title: parsed.data.title,
      body: parsed.data.body || null,
      link: parsed.data.link || null,
    }));
    const { error } = await db.from("notifications").insert(batch);
    if (error) return fail(`Delivery stopped after ${i} recipients. Please retry.`);
  }
  await recordAudit(admin.id, "NOTIFICATION_BROADCAST", "notification", null, {
    title: parsed.data.title,
    audience: parsed.data.audience,
    recipients: ids.length,
  });
  revalidatePath("/admin/notifications");
  return { ok: true, message: `Sent to ${ids.length} user${ids.length === 1 ? "" : "s"}.` };
}

// ---------------------------------------------------------------------------
// Platform settings
// ---------------------------------------------------------------------------

/** Upserts only the given keys, so separate settings forms never overwrite each other. */
async function upsertSettings(adminId: string, values: Partial<PlatformSettings>) {
  const now = new Date().toISOString();
  const rows = (Object.keys(values) as (keyof PlatformSettings)[]).map((key) => ({
    key,
    value: values[key],
    is_public: PUBLIC_SETTING_KEYS.includes(key),
    updated_by: adminId,
    updated_at: now,
  }));
  return createAdminClient().from("platform_settings").upsert(rows, { onConflict: "key" });
}

const settingsSchema = z.object({
  platform_name: z.string().trim().min(2).max(60),
  logo_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || v.startsWith("/") || /^https:\/\//.test(v), "Logo URL must be https:// or a relative path"),
  support_email: z.string().trim().email().max(254),
  default_plan_slug: z.string().trim().min(1).max(40),
  max_upload_files: z.coerce.number().int().min(100).max(50_000),
  pricing_visible: z.string().optional(),
  maintenance_mode: z.string().optional(),
  signup_enabled: z.string().optional(),
  deployments_enabled: z.string().optional(),
  legal_terms: z.string().max(100_000).default(""),
  legal_privacy: z.string().max(100_000).default(""),
  legal_acceptable_use: z.string().max(100_000).default(""),
  legal_refund: z.string().max(100_000).default(""),
  legal_infrastructure: z.string().max(100_000).default(""),
});

export async function saveSettingsAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);
  const s = parsed.data;

  const db = createAdminClient();
  const { data: plan } = await db.from("plans").select("id").eq("slug", s.default_plan_slug).maybeSingle();
  if (!plan) return fail("The default plan slug doesn't match any plan.");

  const values: Pick<PlatformSettings, (typeof GENERAL_SETTING_KEYS)[number]> = {
    platform_name: s.platform_name,
    logo_url: s.logo_url,
    support_email: s.support_email,
    default_plan_slug: s.default_plan_slug,
    max_upload_files: s.max_upload_files,
    pricing_visible: s.pricing_visible === "on",
    maintenance_mode: s.maintenance_mode === "on",
    signup_enabled: s.signup_enabled === "on",
    deployments_enabled: s.deployments_enabled === "on",
    legal_terms: s.legal_terms,
    legal_privacy: s.legal_privacy,
    legal_acceptable_use: s.legal_acceptable_use,
    legal_refund: s.legal_refund,
    legal_infrastructure: s.legal_infrastructure,
  };

  const { error } = await upsertSettings(admin.id, values);
  if (error) return fail("Could not save settings.");

  const { legal_terms, legal_privacy, legal_acceptable_use, legal_refund, legal_infrastructure, ...rest } = values;
  await recordAudit(admin.id, "SETTINGS_UPDATED", "platform_settings", null, {
    ...rest,
    legal_updated: Boolean(legal_terms || legal_privacy || legal_acceptable_use || legal_refund || legal_infrastructure),
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

// ---------------------------------------------------------------------------
// Tax & invoice settings
// ---------------------------------------------------------------------------

const percentField = z.coerce
  .number({ message: "Enter a percentage" })
  .min(0, "Rates can't be negative")
  .max(100, "Rates can't exceed 100%")
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Use at most two decimals")
  .transform((v) => Math.round(v * 100) / 100);

const taxSettingsSchema = z.object({
  gst_rate: percentField,
  tax_home_state: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const code = normalizeStateCode(v);
      if (!code) {
        ctx.addIssue({ code: "custom", message: "Select a valid seller state" });
        return z.NEVER;
      }
      return code;
    }),
  other_tax_name: z.string().trim().min(1, "Other tax name is required").max(40),
  other_tax_rate: percentField,
});

export async function saveTaxSettingsAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = taxSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  const { error } = await upsertSettings(admin.id, parsed.data);
  if (error) return fail("Could not save tax settings.");
  // Only future checkouts use the new values; payments and invoices keep their own snapshot.
  await recordAudit(admin.id, "TAX_SETTINGS_UPDATED", "platform_settings", null, parsed.data);
  revalidatePath("/admin/settings", "layout");
  return { ok: true, message: "Tax settings saved. New checkouts use these rates." };
}

const optionalText = (max: number) => z.string().trim().max(max).default("");

const invoiceSettingsSchema = z.object({
  company_name: z.string().trim().min(2, "Company name is required").max(120),
  company_address: z.string().trim().min(5, "Company address is required").max(500),
  company_phone: optionalText(30),
  company_email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid company email"),
  company_gstin: z
    .string()
    .trim()
    .transform((v) => normalizeGstin(v))
    .refine((v) => v === "" || isValidGstin(v), "Enter a valid 15-character GSTIN"),
  company_logo_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || v.startsWith("/") || /^https:\/\//.test(v), "Logo URL must be https:// or a relative path"),
  invoice_prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "Invoice prefix must be 2–10 letters or digits"),
  invoice_footer: optionalText(2000),
  invoice_tax_note: optionalText(2000),
});

export async function saveInvoiceSettingsAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = invoiceSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  const { error } = await upsertSettings(admin.id, parsed.data);
  if (error) return fail("Could not save invoice settings.");
  // Existing invoices store their own company snapshot and are never rewritten.
  await recordAudit(admin.id, "INVOICE_SETTINGS_UPDATED", "platform_settings", null, {
    company_name: parsed.data.company_name,
    company_gstin: parsed.data.company_gstin,
    invoice_prefix: parsed.data.invoice_prefix,
  });
  revalidatePath("/admin/settings", "layout");
  return { ok: true, message: "Invoice details saved. They apply to invoices issued from now on." };
}
