import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/security/api";
import { getPlanById } from "@/lib/data/plans";
import { activateFreePlan } from "@/lib/data/subscriptions";
import { getPlatformSettings } from "@/lib/data/settings";
import { assertRazorpayConfigured, createOrder, publicKeyId } from "@/lib/razorpay/client";
import {
  billingSnapshot,
  buildQuote,
  gstSnapshot,
  missingInvoiceSettings,
  saveBillingProfile,
  serializeQuote,
} from "@/lib/billing/checkout";
import { billingDetailsSchema, gstDetailsSchema } from "@/lib/billing/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomToken } from "@/lib/utils/crypto";
import { PublicError } from "@/lib/utils/sanitize";

const schema = z.object({
  planId: z.string().uuid(),
  cycle: z.enum(["monthly", "yearly"]),
  coupon: z.string().trim().max(40).optional(),
  // Required for paid plans; validated below so free plans can omit them.
  billing: z.unknown().optional(),
  gst: z.unknown().optional(),
});

/**
 * Creates a Razorpay order for the FINAL amount. The client never sends an
 * amount: plan price, coupon and tax are recalculated here from trusted data.
 */
export const POST = withUser(
  { schema, rateLimit: { key: "create-order", limit: 10, windowMs: 60_000 } },
  async ({ user, body }) => {
    const plan = await getPlanById(body.planId);
    if (!plan || !plan.is_active) throw new PublicError("This plan is not available.", 404);

    if (plan.price_monthly === 0 && plan.price_yearly === 0) {
      await activateFreePlan(user.id, plan);
      return NextResponse.json({ free: true });
    }

    assertRazorpayConfigured();

    const billingParsed = billingDetailsSchema.safeParse(body.billing);
    if (!billingParsed.success) throw new PublicError(billingParsed.error.issues[0]?.message ?? "Invalid billing details.", 422);
    const gstParsed = gstDetailsSchema.safeParse(body.gst ?? { enabled: false });
    if (!gstParsed.success) throw new PublicError(gstParsed.error.issues[0]?.message ?? "Invalid GST details.", 422);
    const billing = billingParsed.data;
    const gst = gstParsed.data;

    const settings = await getPlatformSettings();
    const missing = missingInvoiceSettings(settings);
    if (missing.length > 0) {
      console.error("[checkout] blocked: invoice settings missing:", missing.join(", "));
      throw new PublicError("Checkout is temporarily unavailable because invoicing isn't configured yet. Please contact support.", 503);
    }

    const quote = await buildQuote({ planId: plan.id, cycle: body.cycle, couponCode: body.coupon, stateCode: billing.state });
    const { tax } = quote;

    // Saved before payment so the details are reused next time even if the user abandons checkout.
    await saveBillingProfile(user.id, billing, gst);

    const receipt = `dx_${randomToken(12).replace(/[^A-Za-z0-9]/g, "").slice(0, 16)}`;
    let order: { id: string };
    try {
      order = await createOrder({
        amount: tax.totalAmount,
        currency: plan.currency,
        receipt,
        notes: { user_id: user.id, plan_id: plan.id, cycle: body.cycle },
      });
    } catch (error) {
      console.error("[checkout] Razorpay order creation failed:", error instanceof Error ? error.message : "unknown");
      throw new PublicError("We couldn't start the payment. Please try again in a moment.", 502);
    }

    const { error } = await createAdminClient().from("payments").insert({
      user_id: user.id,
      plan_id: plan.id,
      coupon_id: quote.coupon?.id ?? null,
      billing_cycle: body.cycle,
      order_id: order.id,
      amount: tax.totalAmount,
      discount_amount: tax.discountAmount,
      currency: plan.currency,
      status: "created",
      plan_name: plan.name,
      base_amount: tax.baseAmount,
      taxable_amount: tax.taxableAmount,
      tax_type: tax.taxType,
      gst_rate: tax.gstRate,
      cgst_amount: tax.cgstAmount,
      sgst_amount: tax.sgstAmount,
      igst_amount: tax.igstAmount,
      other_tax_name: tax.otherTaxName,
      other_tax_rate: tax.otherTaxRate,
      other_tax_amount: tax.otherTaxAmount,
      billing_snapshot: billingSnapshot(billing),
      gst_snapshot: gstSnapshot(gst),
      metadata: { receipt, base_amount: tax.baseAmount },
    });
    if (error) {
      console.error("[checkout] payment insert failed:", error.message, error.code);
      throw new PublicError("Could not record the order. Please try again.", 500);
    }

    return NextResponse.json({
      orderId: order.id,
      amount: tax.totalAmount,
      currency: plan.currency,
      keyId: publicKeyId(),
      planName: plan.name,
      quote: serializeQuote(quote),
      prefill: { name: billing.full_name, email: billing.email, contact: billing.phone },
    });
  },
);
