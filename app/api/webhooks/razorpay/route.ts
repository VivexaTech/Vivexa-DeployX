import { getPlanById, getPlanByRazorpayPlanId } from "@/lib/content/public";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { handleRouteError, json } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getRazorpay } from "@/lib/razorpay/client";
import { verifyRazorpayWebhook, type RazorpayWebhookEvent } from "@/lib/razorpay/webhooks";
import {
  applyPaymentFailure,
  applySubscriptionActivation,
  applySubscriptionStatus,
  mapRazorpaySubscriptionStatus,
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

function razorpayEventId(
  event: RazorpayWebhookEvent,
  request: Request,
  payment: Record<string, unknown>,
  subscription: Record<string, unknown>,
) {
  const header = request.headers.get("x-razorpay-event-id")?.trim();
  if (header) return header;
  if (typeof event.id === "string" && event.id.trim()) return event.id.trim();
  return [
    typeof event.event === "string" ? event.event : "event",
    String(payment.id ?? subscription.id ?? "none"),
    String(event.created_at ?? ""),
  ].join(":");
}

async function liveSubscription(subscriptionId: string, fallback: Record<string, unknown>) {
  const currentEnd = (value: unknown): number | string | null => {
    if (typeof value === "number" || typeof value === "string") return value;
    return null;
  };
  if (!subscriptionId) {
    return {
      status: String(fallback.status ?? ""),
      paidCount: Number(fallback.paid_count ?? 0),
      currentEnd: currentEnd(fallback.current_end),
    };
  }
  try {
    const live = await getRazorpay().subscriptions.fetch(subscriptionId);
    return {
      status: String(live.status ?? fallback.status ?? ""),
      paidCount: Number(live.paid_count ?? fallback.paid_count ?? 0),
      currentEnd: currentEnd(live.current_end ?? fallback.current_end),
    };
  } catch (error) {
    logger.warn("razorpay.webhook.fetch_failed", {
      hasSubscription: Boolean(subscriptionId),
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      status: String(fallback.status ?? ""),
      paidCount: Number(fallback.paid_count ?? 0),
      currentEnd: currentEnd(fallback.current_end),
    };
  }
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
    const key = razorpayEventId(event, request, payment, subscription);

    const db = getAdminDb();
    const eventRef = db.collection(collections.webhookEvents).doc(key);
    const claimed = await db.runTransaction(async (tx) => {
      const existing = await tx.get(eventRef);
      if (existing.exists && existing.data()?.status === "completed") return false;
      tx.set(eventRef, {
        eventId: key,
        event: event.event,
        status: "processing",
        createdAt: existing.data()?.createdAt ?? nowIso(),
      });
      return true;
    });
    if (!claimed) {
      logger.info("razorpay.webhook.duplicate", { event: event.event, eventId: key });
      return json({ ok: true, duplicate: true });
    }

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

    const live = await liveSubscription(subscriptionId, subscription);
    logger.info("razorpay.webhook event", {
      event: event.event,
      hasUser: Boolean(resolvedUserId),
      hasPlan: Boolean(resolvedPlanId),
      hasSubscription: Boolean(subscriptionId),
      hasPayment: Boolean(payment.id),
      razorpayStatus: live.status || null,
      paidCount: live.paidCount,
    });

    const paymentId = payment.id ? String(payment.id) : invoice.payment_id ? String(invoice.payment_id) : null;
    const amount = payment.amount
      ? Number(payment.amount) / 100
      : invoice.amount
        ? Number(invoice.amount) / 100
        : undefined;

    switch (event.event) {
      case "subscription.authenticated":
      case "subscription.activated":
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
            status: event.event === "subscription.authenticated" ? "authenticated" : "active",
          });
        } else {
          logger.warn("Razorpay activation skipped; missing user or plan", { event: event.event });
        }
        break;
      }
      case "payment.failed": {
        if (resolvedUserId && live.paidCount < 1) {
          await applyPaymentFailure({
            userId: resolvedUserId,
            razorpaySubscriptionId: subscriptionId || null,
          });
        } else if (resolvedUserId && subscriptionId) {
          await applySubscriptionStatus(subscriptionId, "past_due", {
            paidCount: live.paidCount,
            currentEnd: live.currentEnd,
          });
        }
        break;
      }
      case "subscription.pending": {
        if (subscriptionId && live.paidCount >= 1) {
          await applySubscriptionStatus(subscriptionId, "past_due", {
            paidCount: live.paidCount,
            currentEnd: live.currentEnd,
          });
        } else {
          logger.info("razorpay.webhook.pending_ignored", {
            event: event.event,
            paidCount: live.paidCount,
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
          const mapped: Record<string, SubscriptionStatus> = {
            "subscription.halted": "halted",
            "subscription.cancelled": "cancelled",
            "subscription.completed": "completed",
            "subscription.paused": "paused",
            "subscription.resumed": "active",
          };
          const incoming =
            mapped[event.event] ?? mapRazorpaySubscriptionStatus(live.status || String(subscription.status ?? ""));
          const result = await applySubscriptionStatus(subscriptionId, incoming, {
            paidCount: live.paidCount,
            currentEnd: live.currentEnd,
          });
          logger.info("razorpay.webhook.status_applied", {
            event: event.event,
            incoming,
            applied: result.status,
            reason: result.reason,
            applyToUser: result.applyToUser,
          });
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
