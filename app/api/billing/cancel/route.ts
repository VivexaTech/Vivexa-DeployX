import { verifyRequestUser } from "@/lib/auth/session";
import { getUserProfile } from "@/lib/entitlements";
import { AppError } from "@/lib/errors";
import { handleRouteError, json } from "@/lib/http";
import { getRazorpay } from "@/lib/razorpay/client";
import { applySubscriptionStatus } from "@/lib/subscriptions/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await verifyRequestUser(request);
    const user = await getUserProfile(session.uid);
    if (!user.subscriptionId) {
      throw new AppError("NOT_FOUND", "No active subscription to cancel.", 404);
    }
    const paid =
      user.subscriptionStatus === "active" || user.subscriptionStatus === "authenticated";
    try {
      await getRazorpay().subscriptions.cancel(user.subscriptionId, true);
    } catch {
      // Already cancelled on Razorpay; still mark local period-end cancellation.
    }
    await applySubscriptionStatus(user.subscriptionId, "cancelled", {
      explicitCancel: !paid,
      paidCount: paid ? 1 : 0,
    });
    return json({ ok: true, cancelAtPeriodEnd: paid });
  } catch (error) {
    return handleRouteError(error, "billing.cancel");
  }
}
