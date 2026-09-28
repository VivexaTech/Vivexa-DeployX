import { NextResponse } from "next/server";
import { integrations } from "@/lib/env";
import { verifyWebhookSignature } from "@/lib/razorpay/client";
import { activatePaidSubscription, markPaymentFailed } from "@/lib/razorpay/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

type PaymentEntity = { id: string; order_id: string; amount: number; currency: string; status: string; error_description?: string };
type WebhookBody = {
  event: string;
  payload: {
    payment?: { entity: PaymentEntity };
    refund?: { entity: { id: string; payment_id: string; amount: number } };
  };
};

/**
 * Razorpay webhook. Verifies the HMAC signature over the raw body, stores the
 * event id for idempotency, and processes payment lifecycle events.
 */
export async function POST(request: Request) {
  if (!integrations.razorpayWebhook() || !integrations.supabaseAdmin()) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!signature || !verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventId = request.headers.get("x-razorpay-event-id") ?? createHash("sha256").update(raw).digest("hex");
  const admin = createAdminClient();
  const { error: dupError } = await admin
    .from("webhook_events")
    .insert({ provider: "razorpay", event_id: eventId, event_type: body.event, payload: body });
  if (dupError) {
    if (dupError.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    console.error("[razorpay webhook] store failed", dupError.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  try {
    const payment = body.payload.payment?.entity;
    switch (body.event) {
      case "payment.captured":
      case "order.paid": {
        if (!payment) break;
        const { data } = await admin.from("payments").select("amount, currency").eq("order_id", payment.order_id).maybeSingle();
        const record = data as { amount: number; currency: string } | null;
        if (!record) break;
        if (record.amount !== payment.amount || record.currency !== payment.currency) {
          console.error("[razorpay webhook] amount mismatch for order", payment.order_id);
          break;
        }
        await activatePaidSubscription(payment.order_id, payment.id, null);
        break;
      }
      case "payment.failed": {
        if (payment) await markPaymentFailed(payment.order_id, payment.id, payment.error_description ?? "Payment failed");
        break;
      }
      case "refund.processed":
      case "refund.created": {
        const refund = body.payload.refund?.entity;
        if (refund) {
          await admin.from("payments").update({ status: "refunded" }).eq("payment_id", refund.payment_id).eq("status", "paid");
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("[razorpay webhook] processing failed", error);
    // Allow Razorpay to retry by removing the idempotency record.
    await admin.from("webhook_events").delete().eq("provider", "razorpay").eq("event_id", eventId);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
