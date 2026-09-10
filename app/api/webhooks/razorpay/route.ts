import { getPlanById, getPlanByRazorpayPlanId } from "@/lib/content/public";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { handleRouteError, json } from "@/lib/http";
import { logger } from "@/lib/logger";
import { verifyRazorpayWebhook, type RazorpayWebhookEvent } from "@/lib/razorpay/webhooks";
import {
  applyPaymentFailure,
  applySubscriptionActivation,
  applySubscriptionStatus,
  mapRazorpaySubscriptionStatus,
  razorpayStatusIsPaid,
} from "@/lib/subscriptions/service";
import { nowIso } from "@/lib/utils";
import type { SubscriptionStatus } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function entity(event: RazorpayWebhookEvent, key: "payment" | "subscription" | "invoice") {
  return event.payload?.[key]?.entity ?? {};
}

function notesOf(record: Record<string, unknown>) {
  return (record.notes as Record<string, string> | undefined) ?? {};
}

function eventKey(event: RazorpayWebhookEvent, payment: Record<string, unknown>, subscription: Record<string, unknown>) {
  const id = typeof event.event === "string" ? event.event : "event";
  return [id, String(payment.id ?? subscription.id ?? "none"), String(event.created_at ?? "")].join(":");
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    logger.info("razorpay.webhook reached", {
      bytes: raw.length,
      hasSignature: Boolean(request.headers.get("x-razorpay-signature")),
    });
    verifyRazorpayWebhook(raw, request.headers.get("x-razorpay-signature"));
    const event = JSON.parse(raw) as RazorpayWebhookEvent;
    const payment = entity(event, "payment");
    const subscription = entity(event, "subscription");
    const invoice = entity(event, "invoice");
    const key = eventKey(event, payment, subscription);

    const db = getAdminDb();
    const eventRef = db.collection(collections.webhookEvents).doc(key);
    const existing = await eventRef.get();
    if (existing.exists && existing.data()?.status === "completed") {
      return json({ ok: true, duplicate: true });
    }
    await eventRef.set({
      eventId: key,
      event: event.event,
      status: "processing",
      createdAt: existing.data()?.createdAt ?? nowIso(),
    });

    const subscriptionId = String(
      subscription.id ?? payment.subscription_id ?? invoice.subscription_id ?? "",
    );
    const localSub = subscriptionId
      ? (await db.collection(collections.subscriptions).doc(subscriptionId).get()).data()
      : undefined;

    const resolvedUserId =
      notesOf(subscription).userId ||
      notesOf(payment).userId ||
      notesOf(invoice).userId ||
      String(localSub?.userId ?? "");
    let resolvedPlanId =
      notesOf(subscription).planId ||
      notesOf(payment).planId ||
      notesOf(invoice).planId ||
      String(localSub?.planId ?? "");

    const razorpayPlanId = String(subscription.plan_id ?? localSub?.razorpayPlanId ?? "");
    if (!resolvedPlanId && razorpayPlanId) {
      const plan = await getPlanByRazorpayPlanId(razorpayPlanId);
      resolvedPlanId = plan?.id ?? "";
    }
    if (resolvedPlanId) {
      const plan = await getPlanById(resolvedPlanId);
      if (!plan) {
        logger.warn("Razorpay webhook plan not found in Firestore", { hasPlanId: Boolean(resolvedPlanId) });
      }
    }

    logger.info("razorpay.webhook event", {
      event: event.event,
      hasUser: Boolean(resolvedUserId),
      hasPlan: Boolean(resolvedPlanId),
      hasSubscription: Boolean(subscriptionId),
      hasPayment: Boolean(payment.id),
    });

    const paymentId = payment.id ? String(payment.id) : invoice.payment_id ? String(invoice.payment_id) : null;
    const amount = payment.amount
      ? Number(payment.amount) / 100
      : invoice.amount
        ? Number(invoice.amount) / 100
        : undefined;

    switch (event.event) {
      case "subscription.authenticated":
      case "subscription.activated": {
        if (resolvedUserId && resolvedPlanId) {
          await applySubscriptionActivation({
            userId: resolvedUserId,
            planId: resolvedPlanId,
            razorpaySubscriptionId: subscriptionId || `sub_${resolvedUserId}`,
            paymentId,
            amount,
            status: event.event === "subscription.authenticated" ? "authenticated" : "active",
          });
        } else {
          logger.warn("Razorpay activation skipped; missing user or plan", { event: event.event });
        }
        break;
      }
      case "subscription.charged":
      case "payment.captured":
      case "invoice.paid": {
        if (resolvedUserId && resolvedPlanId) {
          await applySubscriptionActivation({
            userId: resolvedUserId,
            planId: resolvedPlanId,
            razorpaySubscriptionId: subscriptionId || `pay_${String(payment.id ?? "")}`,
            paymentId,
            amount,
            status: "active",
          });
        } else {
          logger.warn("Razorpay capture skipped; missing user or plan", { event: event.event });
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
        if (subscriptionId) {
          const remote = String(subscription.status ?? "");
          const mapped: Record<string, SubscriptionStatus> = {
            "subscription.halted": "halted",
            "subscription.cancelled": "cancelled",
            "subscription.completed": "completed",
            "subscription.paused": "paused",
            "subscription.resumed": "active",
            "subscription.updated": razorpayStatusIsPaid(remote)
              ? mapRazorpaySubscriptionStatus(remote)
              : mapRazorpaySubscriptionStatus(remote),
          };
          await applySubscriptionStatus(subscriptionId, mapped[event.event] ?? "active");
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
