import { verifyRequestUser } from "@/lib/auth/session";
import { getPlanById } from "@/lib/content/public";
import { getUserProfile } from "@/lib/entitlements";
import { getRazorpayPublicKey } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { handleRouteError, json, readJson } from "@/lib/http";
import { getRazorpay } from "@/lib/razorpay/client";
import { razorpayStatusIsPaid } from "@/lib/subscriptions/service";
import { nowIso } from "@/lib/utils";
import { changePlanSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await verifyRequestUser(request);
    const { planId } = changePlanSchema.parse(await readJson(request));
    const plan = await getPlanById(planId);
    if (!plan?.active) throw new AppError("NOT_FOUND", "That plan is not available.", 404);
    if (!plan.razorpayPlanId) {
      throw new AppError("CONFIG_MISSING", "This plan is missing a Razorpay plan ID.", 503);
    }
    const user = await getUserProfile(session.uid);
    const razorpay = getRazorpay();
    if (user.subscriptionId && (user.subscriptionStatus === "active" || user.subscriptionStatus === "authenticated")) {
      const updated = await razorpay.subscriptions.update(user.subscriptionId, {
        plan_id: plan.razorpayPlanId,
        schedule_change_at: "cycle_end",
      });
      return json({ ok: true, subscriptionId: updated.id, changed: true });
    }

    if (user.subscriptionId) {
      try {
        const existing = await razorpay.subscriptions.fetch(user.subscriptionId);
        const remoteStatus = String(existing.status ?? "");
        if (
          razorpayStatusIsPaid(remoteStatus) ||
          Number(existing.paid_count ?? 0) >= 1
        ) {
          return json({ alreadyActive: true, subscriptionId: user.subscriptionId, status: remoteStatus });
        }
      } catch {
        // Create a new checkout subscription below.
      }
    }

    const created = await razorpay.subscriptions.create({
      plan_id: plan.razorpayPlanId,
      total_count: plan.billingCycle === "yearly" ? 20 : 120,
      customer_notify: 1,
      notes: { userId: session.uid, planId: plan.id, email: user.email },
    });
    await getAdminDb().collection(collections.subscriptions).doc(String(created.id)).set({
      subscriptionId: created.id,
      userId: session.uid,
      planId: plan.id,
      razorpaySubscriptionId: created.id,
      razorpayPlanId: plan.razorpayPlanId,
      status: "pending",
      startDate: null,
      renewalDate: null,
      amount: plan.planPrice,
      currency: plan.currency,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await getAdminDb().collection(collections.users).doc(session.uid).set(
      {
        subscriptionId: String(created.id),
        subscriptionStatus: "pending",
        updatedAt: nowIso(),
      },
      { merge: true },
    );
    return json({
      keyId: getRazorpayPublicKey(),
      subscriptionId: created.id,
      planName: plan.planName,
      amount: plan.planPrice,
      currency: plan.currency,
      name: user.name,
      email: user.email,
      checkout: true,
    });
  } catch (error) {
    return handleRouteError(error, "billing.change");
  }
}
