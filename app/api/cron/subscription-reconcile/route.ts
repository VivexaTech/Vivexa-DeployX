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
        if (razorpayStatusIsPaid(remoteStatus) && userId && planId && localStatus === "pending") {
          await applySubscriptionActivation({
            userId,
            planId,
            razorpaySubscriptionId: doc.id,
            status: mapped,
          });
          updated += 1;
          continue;
        }
        if (mapped && mapped !== localStatus) {
          await applySubscriptionStatus(doc.id, mapped);
          updated += 1;
        }
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
