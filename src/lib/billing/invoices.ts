import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/data/settings";
import type { Invoice } from "@/types/database";

/**
 * Issues the invoice for a paid payment, or returns the one already issued.
 * Idempotency and gap-free numbering are enforced in the database function
 * (row lock + unique payment_id). The company details passed here are copied
 * into the invoice, so later settings changes never alter issued invoices.
 */
export async function ensureInvoice(paymentId: string): Promise<Invoice | null> {
  const db = createAdminClient();
  const { data: existing } = await db.from("invoices").select("*").eq("payment_id", paymentId).maybeSingle();
  if (existing) return existing as Invoice;

  const { data: payment } = await db
    .from("payments")
    .select("status, billing_snapshot, subscription_id")
    .eq("id", paymentId)
    .maybeSingle();
  const row = payment as { status: string; billing_snapshot: unknown; subscription_id: string | null } | null;
  // Payments created before billing details were collected have nothing to invoice against.
  if (!row || row.status !== "paid" || !row.billing_snapshot) return null;
  // Until activation links the subscription, the caller that claimed the payment is still
  // working and will issue the invoice itself (with the correct billing period).
  if (!row.subscription_id) return null;

  const settings = await getPlatformSettings();
  const { data, error } = await db.rpc("create_invoice_for_payment", {
    p_payment_id: paymentId,
    p_company: {
      name: settings.company_name,
      logo: settings.company_logo_url,
      address: settings.company_address,
      phone: settings.company_phone,
      email: settings.company_email,
      gstin: settings.company_gstin,
    },
    p_prefix: settings.invoice_prefix,
    p_footer: settings.invoice_footer,
    p_tax_note: settings.invoice_tax_note,
  });
  if (error) {
    console.error("[invoice] generation failed for payment", paymentId, error.message);
    return null;
  }
  return data as Invoice;
}
