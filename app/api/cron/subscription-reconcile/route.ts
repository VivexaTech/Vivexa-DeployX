import { assertCronAccess } from "@/lib/cron";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { handleRouteError, json } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpay/client";
import {
  applySubscriptionActivation,
  applySubscriptionStatus,
  mapRazorpaySubscriptionStatus,
  razorpayStatusIsPaid,
} from "@/lib/subscriptions/service";
import { nowIso } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    assertCronAccess(request);
    if (!razorpayConfigured()) return json({ ok: true, skipped: true });
    const db = getAdminDb();
    const snap = await db.collection(collections.subscriptions).limit(100).get();
    const razorpay = getRazorpay();
    let updated = 0;
    for (const doc of snap.docs) {
      try {
        const remote = await razorpay.subscriptions.fetch(doc.id);
        const remoteStatus = String(remote.status ?? "");
        const mapped = mapRazorpaySubscriptionStatus(remoteStatus);
        const localStatus = String(doc.data().status ?? "");
        const userId = String(doc.data().userId ?? "");
        const planId = String(doc.data().planId ?? "");
        const paidCount = Number(remote.paid_count ?? 0);
        if ((razorpayStatusIsPaid(remoteStatus) || paidCount >= 1) && userId && planId && localStatus !== mapped) {
          if (localStatus === "pending" || localStatus === "failed" || localStatus === "cancelled") {
            await applySubscriptionActivation({
              userId,
              planId,
              razorpaySubscriptionId: doc.id,
              status: razorpayStatusIsPaid(remoteStatus) ? mapped : "active",
            });
          }
        }
        await applySubscriptionStatus(doc.id, mapped, {
          paidCount,
          currentEnd: remote.current_end as number | undefined,
        });
        updated += 1;
      } catch (error) {
        logger.warn("Subscription reconcile skipped", {
          subscriptionId: doc.id,
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    }
    return json({ ok: true, updated, checkedAt: nowIso() });
  } catch (error) {
    return handleRouteError(error, "cron.reconcile");
  }
}
