import { assertCronAccess } from "@/lib/cron";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { handleRouteError, json } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpay/client";
import { applySubscriptionStatus } from "@/lib/subscriptions/service";
import { nowIso } from "@/lib/utils";
import type { SubscriptionStatus } from "@/types";

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
        const status = String(remote.status) as SubscriptionStatus;
        if (status && status !== doc.data().status) {
          await applySubscriptionStatus(doc.id, status);
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
