import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanById } from "@/lib/data/plans";
import { getPlatformSettings, type PlatformSettings } from "@/lib/data/settings";
import { planPrice, resolveCoupon } from "@/lib/razorpay/billing";
import { calculateTax, stateName, type TaxBreakdown, type TaxConfig } from "@/lib/billing/tax";
import type { BillingDetails, GstDetails } from "@/lib/billing/schema";
import { PublicError } from "@/lib/utils/sanitize";
import type { BillingProfile, Coupon, Plan } from "@/types/database";

export type PaidCycle = "monthly" | "yearly";

export type CheckoutQuote = {
  plan: Plan;
  cycle: PaidCycle;
  coupon: Coupon | null;
  tax: TaxBreakdown;
};

export function taxConfigFrom(settings: PlatformSettings): TaxConfig {
  return {
    gstRate: settings.gst_rate,
    homeStateCode: settings.tax_home_state,
    otherTaxName: settings.other_tax_name || "Other Tax",
    otherTaxRate: settings.other_tax_rate,
  };
}

/** Seller details required before an invoice can legitimately be issued. */
export function missingInvoiceSettings(settings: PlatformSettings): string[] {
  const missing: string[] = [];
  if (!settings.company_name.trim()) missing.push("company name");
  if (!settings.company_address.trim()) missing.push("company address");
  return missing;
}

/**
 * Authoritative price calculation. Everything is derived from the database
 * (plan price, coupon) and server configuration (tax rates); the client only
 * supplies identifiers and the billing state.
 */
export async function buildQuote(input: {
  planId: string;
  cycle: PaidCycle;
  couponCode?: string;
  stateCode: string;
}): Promise<CheckoutQuote> {
  const plan = await getPlanById(input.planId);
  if (!plan || !plan.is_active) throw new PublicError("This plan is not available.", 404);

  const baseAmount = planPrice(plan, input.cycle);
  if (baseAmount <= 0) throw new PublicError("This billing cycle is not available for the selected plan.", 422);

  const { coupon, discount } = await resolveCoupon(input.couponCode || undefined, plan, baseAmount);
  const settings = await getPlatformSettings();

  let tax: TaxBreakdown;
  try {
    tax = calculateTax({ baseAmount, discountAmount: discount, stateCode: input.stateCode, config: taxConfigFrom(settings) });
  } catch (error) {
    console.error("[checkout] tax calculation failed:", error instanceof Error ? error.message : error);
    throw new PublicError("We couldn't calculate tax for this billing address. Check the selected state and try again.", 422);
  }
  if (tax.totalAmount < 100) throw new PublicError("The payable amount must be at least ₹1.", 422);

  return { plan, cycle: input.cycle, coupon, tax };
}

const MIGRATION_HINT = "run supabase/migrations/0002_checkout_tax_invoices.sql in the Supabase SQL Editor";

/** PostgREST / Postgres codes for a table or column that doesn't exist yet. */
function isMissingSchema(error: { code?: string }): boolean {
  return ["PGRST205", "PGRST204", "42P01", "42703"].includes(error.code ?? "");
}

export async function getBillingProfile(userId: string): Promise<BillingProfile | null> {
  const { data, error } = await createAdminClient().from("billing_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) {
    if (isMissingSchema(error)) console.warn(`[checkout] billing_profiles table missing — ${MIGRATION_HINT}`);
    else console.error("[checkout] billing profile lookup failed:", error.message);
    return null;
  }
  return (data as BillingProfile | null) ?? null;
}

/** One profile per user (unique user_id), so this updates in place rather than duplicating. */
export async function saveBillingProfile(userId: string, billing: BillingDetails, gst: GstDetails): Promise<void> {
  const { error } = await createAdminClient()
    .from("billing_profiles")
    .upsert(
      {
        user_id: userId,
        ...billing,
        gst_enabled: gst.enabled,
        gstin: gst.gstin,
        gst_legal_name: gst.legal_name,
        gst_address: gst.address,
      },
      { onConflict: "user_id" },
    );
  if (error) {
    if (isMissingSchema(error)) {
      console.error(`[checkout] billing_profiles table missing — ${MIGRATION_HINT}`);
      throw new PublicError("Checkout is temporarily unavailable because billing isn't set up yet. Please contact support.", 503);
    }
    console.error("[checkout] billing profile save failed:", error.message, error.code);
    throw new PublicError("Your billing details could not be saved. Please try again.", 500);
  }
}

/** Immutable copy stored on the payment and later on the invoice. */
export function billingSnapshot(billing: BillingDetails) {
  return {
    ...billing,
    state_name: stateName(billing.state),
    country_name: billing.country === "IN" ? "India" : billing.country,
  };
}

export function gstSnapshot(gst: GstDetails) {
  return gst.enabled ? { gstin: gst.gstin, legal_name: gst.legal_name, address: gst.address } : null;
}

/** Wire format sent to the checkout UI. */
export function serializeQuote(quote: CheckoutQuote) {
  return {
    planId: quote.plan.id,
    planName: quote.plan.name,
    cycle: quote.cycle,
    currency: quote.plan.currency,
    couponCode: quote.coupon?.code ?? null,
    ...quote.tax,
  };
}

export type SerializedQuote = ReturnType<typeof serializeQuote>;
