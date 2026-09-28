import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/data/notifications";
import { periodEnd } from "@/lib/data/subscriptions";
import { PublicError } from "@/lib/utils/sanitize";
import { formatCurrency } from "@/lib/utils";
import { ensureInvoice } from "@/lib/billing/invoices";
import type { BillingCycle, Coupon, Payment, Plan } from "@/types/database";

export function planPrice(plan: Plan, cycle: BillingCycle): number {
  return cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
}

/** Validates a coupon for a plan and returns the discount in paise. */
export async function resolveCoupon(
  code: string | undefined,
  plan: Plan,
  amount: number,
): Promise<{ coupon: Coupon | null; discount: number }> {
  if (!code) return { coupon: null, discount: 0 };
  const { data } = await createAdminClient()
    .from("coupons")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  const coupon = data as Coupon | null;
  const now = Date.now();
  if (
    !coupon ||
    !coupon.is_active ||
    (coupon.valid_from && new Date(coupon.valid_from).getTime() > now) ||
    (coupon.valid_until && new Date(coupon.valid_until).getTime() < now) ||
    (coupon.max_redemptions !== null && coupon.redeemed_count >= coupon.max_redemptions) ||
    (coupon.plan_ids && coupon.plan_ids.length > 0 && !coupon.plan_ids.includes(plan.id))
  ) {
    throw new PublicError("This coupon is invalid or has expired.", 422);
  }
  const discount =
    coupon.discount_type === "percent"
      ? Math.floor((amount * Math.min(coupon.discount_value, 100)) / 100)
      : Math.min(coupon.discount_value, amount);
  return { coupon, discount };
}

/**
 * Activates the subscription for a verified, captured payment. Idempotent: the
 * verify endpoint and the webhook may both call this for the same payment.
 */
export async function activatePaidSubscription(orderId: string, paymentId: string, signature: string | null): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("payments").select("*, plan:plans(*)").eq("order_id", orderId).maybeSingle();
  if (!data) throw new PublicError("Payment order not found.", 404);
  const payment = data as Payment & { plan: Plan };

  if (payment.status === "paid") {
    await ensureInvoice(payment.id);
    return;
  }

  // Atomic claim: only one caller (verify endpoint or webhook) proceeds past this point.
  const { data: claimed } = await admin
    .from("payments")
    .update({ status: "paid", payment_id: paymentId, razorpay_signature: signature, failure_reason: null, paid_at: new Date().toISOString() })
    .eq("id", payment.id)
    .neq("status", "paid")
    .select("id");
  if (!claimed || claimed.length === 0) return;

  const start = new Date();
  const { data: current } = await admin
    .from("subscriptions")
    .select("plan_id, current_period_end")
    .eq("user_id", payment.user_id)
    .eq("status", "active")
    .maybeSingle();
  const existing = current as { plan_id: string; current_period_end: string | null } | null;
  // Renewing the same plan early extends the remaining period instead of discarding it.
  const periodBase =
    existing?.plan_id === payment.plan_id && existing.current_period_end && new Date(existing.current_period_end) > start
      ? new Date(existing.current_period_end)
      : start;

  await admin
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("user_id", payment.user_id)
    .eq("status", "active");

  const { data: sub, error } = await admin
    .from("subscriptions")
    .insert({
      user_id: payment.user_id,
      plan_id: payment.plan_id,
      status: "active",
      billing_cycle: payment.billing_cycle,
      current_period_start: start.toISOString(),
      current_period_end: periodEnd(periodBase, payment.billing_cycle)?.toISOString() ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  await admin.from("payments").update({ subscription_id: (sub as { id: string }).id }).eq("id", payment.id);

  if (payment.coupon_id) {
    await admin.from("coupon_redemptions").insert({ coupon_id: payment.coupon_id, user_id: payment.user_id, payment_id: payment.id });
    const { data: coupon } = await admin.from("coupons").select("redeemed_count").eq("id", payment.coupon_id).single();
    if (coupon) {
      await admin
        .from("coupons")
        .update({ redeemed_count: (coupon as { redeemed_count: number }).redeemed_count + 1 })
        .eq("id", payment.coupon_id);
    }
  }

  const invoice = await ensureInvoice(payment.id);

  await createNotification(payment.user_id, {
    type: "payment_success",
    title: "Payment successful",
    body: `${formatCurrency(payment.amount, payment.currency)} received. Your ${payment.plan_name ?? payment.plan.name} plan is now active.${
      invoice ? ` Invoice ${invoice.invoice_number} is available.` : ""
    }`,
    link: invoice ? `/invoices/${invoice.id}` : "/dashboard/billing",
  });
}

export async function markPaymentFailed(orderId: string, paymentId: string | null, reason: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payments")
    .update({ status: "failed", payment_id: paymentId, failure_reason: reason.slice(0, 500) })
    .eq("order_id", orderId)
    .in("status", ["created", "failed"])
    .select("user_id");
  const row = (data as { user_id: string }[] | null)?.[0];
  if (row) {
    await createNotification(row.user_id, {
      type: "payment_failed",
      title: "Payment failed",
      body: reason,
      link: "/dashboard/billing",
    });
  }
}
