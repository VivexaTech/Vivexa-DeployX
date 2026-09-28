import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/security/api";
import { assertRazorpayConfigured, fetchPayment, verifyCheckoutSignature } from "@/lib/razorpay/client";
import { activatePaidSubscription, markPaymentFailed } from "@/lib/razorpay/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureInvoice } from "@/lib/billing/invoices";
import { PublicError } from "@/lib/utils/sanitize";
import type { Payment } from "@/types/database";

async function paidResponse(paymentRowId: string) {
  const invoice = await ensureInvoice(paymentRowId);
  const { data } = await createAdminClient()
    .from("payments")
    .select("payment_id, amount, currency, plan_name, billing_cycle")
    .eq("id", paymentRowId)
    .single();
  const row = data as Pick<Payment, "payment_id" | "amount" | "currency" | "plan_name" | "billing_cycle"> | null;
  return NextResponse.json({
    status: "paid",
    paymentId: row?.payment_id ?? null,
    amount: row?.amount ?? null,
    currency: row?.currency ?? "INR",
    planName: row?.plan_name ?? null,
    cycle: row?.billing_cycle ?? null,
    invoice: invoice ? { id: invoice.id, number: invoice.invoice_number } : null,
  });
}

const schema = z.object({
  orderId: z.string().min(1).max(64),
  paymentId: z.string().min(1).max(64),
  signature: z.string().min(1).max(256),
});

/**
 * Verifies a checkout result server-side: signature check, then confirms the
 * payment with Razorpay's API (status, order and amount) before activation.
 */
export const POST = withUser(
  { schema, rateLimit: { key: "verify-payment", limit: 20, windowMs: 60_000 } },
  async ({ user, body }) => {
    assertRazorpayConfigured();
    const admin = createAdminClient();
    const { data } = await admin
      .from("payments")
      .select("*")
      .eq("order_id", body.orderId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) throw new PublicError("Order not found.", 404);
    const payment = data as Payment;

    // Duplicate callback (retry, second tab, webhook got there first): report the existing result.
    if (payment.status === "paid") return paidResponse(payment.id);

    if (!verifyCheckoutSignature(body.orderId, body.paymentId, body.signature)) {
      await admin
        .from("payments")
        .update({ failure_reason: "Invalid checkout signature", metadata: { ...payment.metadata, invalid_signature_at: new Date().toISOString() } })
        .eq("id", payment.id);
      throw new PublicError("Payment verification failed. If you were charged, contact support with your order id.", 400);
    }

    const remote = await fetchPayment(body.paymentId);
    if (remote.order_id !== payment.order_id || remote.amount !== payment.amount || remote.currency !== payment.currency) {
      throw new PublicError("Payment details do not match the order. Contact support.", 400);
    }

    if (remote.status === "captured") {
      await activatePaidSubscription(payment.order_id, remote.id, body.signature);
      return paidResponse(payment.id);
    }
    if (remote.status === "failed") {
      await markPaymentFailed(payment.order_id, remote.id, remote.error_description ?? "Payment failed");
      return NextResponse.json({ status: "failed" }, { status: 402 });
    }

    // Authorized but not yet captured: the webhook will activate the plan once captured.
    await admin.from("payments").update({ payment_id: remote.id, razorpay_signature: body.signature }).eq("id", payment.id);
    return NextResponse.json({ status: "pending" }, { status: 202 });
  },
);
