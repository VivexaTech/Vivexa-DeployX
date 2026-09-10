import { verifyRequestUser } from "@/lib/auth/session";
import { getPlanById } from "@/lib/content/public";
import { getUserProfile } from "@/lib/entitlements";
import { getRazorpayPublicKey } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { handleRouteError, json, readJson } from "@/lib/http";
import { getRazorpay } from "@/lib/razorpay/client";
import { changePlanSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await verifyRequestUser(request);
    const { planId } = changePlanSchema.parse(await readJson(request));
    const plan = await getPlanById(planId);
    if (!plan?.active) throw new AppError("NOT_FOUND", "That plan is not available.", 404);
    const user = await getUserProfile(session.uid);
    if (user.subscriptionId && (user.subscriptionStatus === "active" || user.subscriptionStatus === "authenticated")) {
      const updated = await getRazorpay().subscriptions.update(user.subscriptionId, {
        plan_id: plan.razorpayPlanId,
        schedule_change_at: "now",
      });
      return json({ ok: true, subscriptionId: updated.id, changed: true });
    }
    const created = await getRazorpay().subscriptions.create({
      plan_id: plan.razorpayPlanId,
      total_count: plan.billingCycle === "yearly" ? 20 : 120,
      customer_notify: 1,
      notes: { userId: session.uid, planId: plan.id, email: user.email },
    });
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
