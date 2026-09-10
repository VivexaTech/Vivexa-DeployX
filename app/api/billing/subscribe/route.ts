import { verifyRequestUser } from "@/lib/auth/session";
import { getPlanById } from "@/lib/content/public";
import { getUserProfile } from "@/lib/entitlements";
import { getAppUrl, getRazorpayPublicKey } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { handleRouteError, json, readJson } from "@/lib/http";
import { getRazorpay } from "@/lib/razorpay/client";
import { enforceRateLimit } from "@/lib/rate-limit";
import { nowIso } from "@/lib/utils";
import { subscribeSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await verifyRequestUser(request);
    await enforceRateLimit(session.uid, "billing");
    const { planId } = subscribeSchema.parse(await readJson(request));
    const plan = await getPlanById(planId);
    if (!plan || !plan.active) {
      throw new AppError("NOT_FOUND", "That plan is not available.", 404);
    }
    if (!plan.razorpayPlanId) {
      throw new AppError(
        "CONFIG_MISSING",
        "This plan is missing a Razorpay plan ID. Configure it in Firestore before accepting payments.",
        503,
      );
    }
    const user = await getUserProfile(session.uid);
    const razorpay = getRazorpay();
    const subscription = await razorpay.subscriptions.create({
      plan_id: plan.razorpayPlanId,
      total_count: plan.billingCycle === "yearly" ? 20 : 120,
      customer_notify: 1,
      notes: {
        userId: session.uid,
        planId: plan.id,
        email: user.email,
      },
    });

    await getAdminDb().collection(collections.subscriptions).doc(String(subscription.id)).set({
      subscriptionId: subscription.id,
      userId: session.uid,
      planId: plan.id,
      razorpaySubscriptionId: subscription.id,
      razorpayPlanId: plan.razorpayPlanId,
      status: "pending",
      startDate: null,
      renewalDate: null,
      amount: plan.planPrice,
      currency: plan.currency,
      reminderSentForRenewal: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    await getAdminDb().collection(collections.users).doc(session.uid).set(
      {
        subscriptionId: String(subscription.id),
        subscriptionStatus: "pending",
        updatedAt: nowIso(),
      },
      { merge: true },
    );

    return json({
      keyId: getRazorpayPublicKey(),
      subscriptionId: subscription.id,
      planName: plan.planName,
      amount: plan.planPrice,
      currency: plan.currency,
      name: user.name,
      email: user.email,
      callbackUrl: `${getAppUrl()}/dashboard/billing?checkout=1`,
    });
  } catch (error) {
    return handleRouteError(error, "billing.subscribe");
  }
}
