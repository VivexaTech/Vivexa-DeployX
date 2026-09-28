import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/permissions";
import { PrintInvoiceButton } from "@/components/billing/print-invoice-button";
import { formatRate, INDIAN_STATES } from "@/lib/billing/tax";
import { formatDate, formatMoney } from "@/lib/utils";
import type { Invoice } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  let title = "Invoice";
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const supabase = await createClient();
    const { data } = await supabase.from("invoices").select("invoice_number").eq("id", id).maybeSingle();
    if (data) title = `Invoice ${(data as { invoice_number: string }).invoice_number}`;
  }
  // The title doubles as the default file name when saving the invoice as PDF.
  return { title: { absolute: title }, robots: { index: false } };
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t border-neutral-300 pt-2 text-[15px] font-semibold" : "flex justify-between text-neutral-700"}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // RLS limits this to the invoice owner (or an admin).
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const invoice = data as Invoice;
  const money = (v: number) => formatMoney(v, invoice.currency);
  const gstCode = INDIAN_STATES.find((s) => s.code === invoice.customer_state_code)?.gstCode;
  const backHref = isAdminRole(user.profile.role) && invoice.user_id !== user.id ? "/admin/payments" : "/dashboard/billing";
  const cycle = invoice.billing_cycle === "yearly" ? "Annual" : invoice.billing_cycle === "monthly" ? "Monthly" : "";

  return (
    <div className="min-h-screen bg-background px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to billing
        </Link>
        <PrintInvoiceButton />
      </div>

      <article className="mx-auto max-w-3xl rounded-xl border border-border bg-white p-8 text-[13px] leading-relaxed text-neutral-900 shadow-card sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-col gap-6 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            {invoice.company_logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={invoice.company_logo} alt={invoice.company_name} className="mb-3 h-12 w-auto max-w-[200px] object-contain" />
            )}
            <p className="text-base font-semibold">{invoice.company_name}</p>
            {invoice.company_address && <p className="whitespace-pre-line text-neutral-600">{invoice.company_address}</p>}
            <p className="text-neutral-600">{[invoice.company_phone, invoice.company_email].filter(Boolean).join(" · ")}</p>
            {invoice.company_gstin && <p className="mt-1 font-medium">GSTIN: {invoice.company_gstin}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-xl font-semibold tracking-tight">{invoice.company_gstin ? "Tax Invoice" : "Invoice"}</p>
            <dl className="mt-2 space-y-0.5 text-neutral-700">
              <div>
                <dt className="inline text-neutral-500">Invoice no. </dt>
                <dd className="inline font-medium text-neutral-900">{invoice.invoice_number}</dd>
              </div>
              <div>
                <dt className="inline text-neutral-500">Invoice date </dt>
                <dd className="inline">{formatDate(invoice.created_at)}</dd>
              </div>
              <div>
                <dt className="inline text-neutral-500">Status </dt>
                <dd className={invoice.status === "paid" ? "inline font-medium text-emerald-700" : "inline font-medium text-amber-700"}>
                  {invoice.status === "paid" ? "Paid" : invoice.status === "refunded" ? "Refunded" : "Void"}
                </dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="grid gap-6 border-b border-neutral-200 py-6 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">Bill to</p>
            <p className="font-semibold">{invoice.customer_name}</p>
            {invoice.customer_company && <p>{invoice.customer_company}</p>}
            {invoice.customer_address && <p className="text-neutral-700">{invoice.customer_address}</p>}
            <p className="text-neutral-700">
              {[invoice.customer_city, invoice.customer_state].filter(Boolean).join(", ")} {invoice.customer_postal_code}
            </p>
            {invoice.customer_country && <p className="text-neutral-700">{invoice.customer_country}</p>}
            <p className="mt-1 text-neutral-700">{[invoice.customer_email, invoice.customer_phone].filter(Boolean).join(" · ")}</p>
            {invoice.customer_gstin && (
              <div className="mt-2">
                <p className="font-medium">GSTIN: {invoice.customer_gstin}</p>
                {invoice.customer_gst_legal_name && <p className="text-neutral-700">{invoice.customer_gst_legal_name}</p>}
                {invoice.customer_gst_address && <p className="whitespace-pre-line text-neutral-700">{invoice.customer_gst_address}</p>}
              </div>
            )}
          </div>
          <div className="sm:text-right">
            <p className="mb-1 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">Payment</p>
            <p className="text-neutral-700">Paid on {formatDate(invoice.paid_at, true)}</p>
            {invoice.razorpay_payment_id && <p className="text-neutral-700">Payment ID: <span className="font-mono text-xs">{invoice.razorpay_payment_id}</span></p>}
            {invoice.razorpay_order_id && <p className="text-neutral-700">Order ID: <span className="font-mono text-xs">{invoice.razorpay_order_id}</span></p>}
            {invoice.customer_state && (
              <p className="mt-2 text-neutral-700">
                Place of supply: {invoice.customer_state}
                {gstCode ? ` (${gstCode})` : ""}
              </p>
            )}
          </div>
        </section>

        <section className="py-6">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-300 text-[11px] tracking-wider text-neutral-500 uppercase">
                <th className="pb-2 font-semibold">Description</th>
                <th className="pb-2 font-semibold">Billing period</th>
                <th className="pb-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-200 align-top">
                <td className="py-3">
                  <p className="font-medium">
                    {invoice.plan_name} plan{cycle ? ` — ${cycle} subscription` : ""}
                  </p>
                  <p className="text-xs text-neutral-500">Prepaid, non-recurring</p>
                </td>
                <td className="py-3 text-neutral-700">
                  {invoice.period_start ? `${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)}` : "—"}
                </td>
                <td className="py-3 text-right tabular-nums">{money(invoice.base_amount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5">
            <Row label="Plan price" value={money(invoice.base_amount)} />
            {invoice.discount_amount > 0 && (
              <>
                <Row label="Discount" value={`−${money(invoice.discount_amount)}`} />
                <Row label="Taxable value" value={money(invoice.taxable_amount)} />
              </>
            )}
            {invoice.tax_type === "intra_state" && (
              <>
                <Row label={`CGST @ ${formatRate(invoice.gst_rate / 2)}%`} value={money(invoice.cgst_amount)} />
                <Row label={`SGST @ ${formatRate(invoice.gst_rate / 2)}%`} value={money(invoice.sgst_amount)} />
              </>
            )}
            {invoice.tax_type === "inter_state" && <Row label={`IGST @ ${formatRate(invoice.gst_rate)}%`} value={money(invoice.igst_amount)} />}
            {invoice.other_tax_amount > 0 && (
              <Row label={`${invoice.other_tax_name ?? "Other tax"} @ ${formatRate(invoice.other_tax_rate)}%`} value={money(invoice.other_tax_amount)} />
            )}
            <Row label="Total" value={money(invoice.total_amount)} strong />
            <p className="pt-1 text-right text-xs text-neutral-500">Amount paid: {money(invoice.total_amount)}</p>
          </div>
        </section>

        {(invoice.tax_note || invoice.footer_note) && (
          <footer className="space-y-2 border-t border-neutral-200 pt-5 text-xs text-neutral-600">
            {invoice.tax_note && <p className="whitespace-pre-line">{invoice.tax_note}</p>}
            {invoice.footer_note && <p className="whitespace-pre-line">{invoice.footer_note}</p>}
          </footer>
        )}
        <p className="mt-6 text-center text-[11px] text-neutral-400">This is a computer-generated invoice.</p>
      </article>
    </div>
  );
}
