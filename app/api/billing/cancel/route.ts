import { verifyRequestUser } from "@/lib/auth/session";
import { getUserProfile } from "@/lib/entitlements";
import { AppError } from "@/lib/errors";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { handleRouteError, json } from "@/lib/http";
import { getRazorpay } from "@/lib/razorpay/client";
import { nowIso } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await verifyRequestUser(request);
    const user = await getUserProfile(session.uid);
    if (!user.subscriptionId) {
      throw new AppError("NOT_FOUND", "No active subscription to cancel.", 404);
    }
    await getRazorpay().subscriptions.cancel(user.subscriptionId, false);
    await getAdminDb().collection(collections.users).doc(session.uid).set(
      { subscriptionStatus: "cancelled", updatedAt: nowIso() },
      { merge: true },
    );
    await getAdminDb().collection(collections.subscriptions).doc(user.subscriptionId).set(
      { status: "cancelled", updatedAt: nowIso() },
      { merge: true },
    );
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "billing.cancel");
  }
}
