import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { handleRouteError, json } from "@/lib/http";
import { logger } from "@/lib/logger";
import { verifyRazorpayWebhook, type RazorpayWebhookEvent } from "@/lib/razorpay/webhooks";
import {
  applyPaymentFailure,
  applySubscriptionActivation,
  applySubscriptionStatus,
} from "@/lib/subscriptions/service";
import { nowIso } from "@/lib/utils";
import type { SubscriptionStatus } from "@/types";

export const runtime = "nodejs";

function entity(event: RazorpayWebhookEvent, key: "payment" | "subscription") {
  return event.payload?.[key]?.entity ?? {};
}

function notesOf(record: Record<string, unknown>) {
  return (record.notes as Record<string, string> | undefined) ?? {};
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    verifyRazorpayWebhook(raw, request.headers.get("x-razorpay-signature"));
    const event = JSON.parse(raw) as RazorpayWebhookEvent;
    const payment = entity(event, "payment");
    const subscription = entity(event, "subscription");
    const eventKey = [
      event.event,
      String(payment.id ?? subscription.id ?? "none"),
      String(event.created_at ?? ""),
    ].join(":");

    const db = getAdminDb();
    const eventRef = db.collection(collections.webhookEvents).doc(eventKey);
    const existing = await eventRef.get();
    if (existing.exists && existing.data()?.status === "completed") {
      return json({ ok: true, duplicate: true });
    }
    await eventRef.set({
      eventId: eventKey,
      event: event.event,
      status: "processing",
      createdAt: existing.data()?.createdAt ?? nowIso(),
    });

    const userId = notesOf(subscription).userId || notesOf(payment).userId;
    const planId = notesOf(subscription).planId || notesOf(payment).planId;
    const subscriptionId = String(subscription.id ?? payment.subscription_id ?? "");

    const resolvedUserId = userId || (subscriptionId
      ? String((await db.collection(collections.subscriptions).doc(subscriptionId).get()).data()?.userId ?? "")
      : "");
    const resolvedPlanId = planId || (subscriptionId
      ? String((await db.collection(collections.subscriptions).doc(subscriptionId).get()).data()?.planId ?? "")
      : "");

    switch (event.event) {
      case "subscription.authenticated":
      case "subscription.activated":
      case "subscription.charged":
      case "payment.captured": {
        if (resolvedUserId && resolvedPlanId) {
          await applySubscriptionActivation({
            userId: resolvedUserId,
            planId: resolvedPlanId,
            razorpaySubscriptionId: subscriptionId || `pay_${String(payment.id ?? "")}`,
            paymentId: payment.id ? String(payment.id) : null,
            amount: payment.amount ? Number(payment.amount) / 100 : undefined,
            status: "active",
          });
        } else {
          logger.warn("Razorpay event missing user/plan notes", { event: event.event });
        }
        break;
      }
      case "payment.failed":
      case "subscription.pending": {
        if (resolvedUserId) {
          await applyPaymentFailure({
            userId: resolvedUserId,
            razorpaySubscriptionId: subscriptionId || null,
          });
        }
        break;
      }
      case "subscription.halted":
      case "subscription.cancelled":
      case "subscription.completed":
      case "subscription.paused":
      case "subscription.resumed":
      case "subscription.updated": {
        const map: Record<string, SubscriptionStatus> = {
          "subscription.halted": "halted",
          "subscription.cancelled": "cancelled",
          "subscription.completed": "completed",
          "subscription.paused": "paused",
          "subscription.resumed": "active",
          "subscription.updated": (subscription.status as SubscriptionStatus) || "active",
        };
        if (subscriptionId) {
          await applySubscriptionStatus(subscriptionId, map[event.event] ?? "active");
        }
        break;
      }
      default:
        logger.info("Unhandled Razorpay event", { event: event.event });
    }

    await eventRef.set({ status: "completed", completedAt: nowIso() }, { merge: true });
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "webhooks.razorpay");
  }
}
