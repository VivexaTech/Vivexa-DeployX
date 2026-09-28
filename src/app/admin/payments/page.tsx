import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination, TableToolbar } from "@/components/ui/table-toolbar";
import { PaymentReviewButton } from "@/components/admin/payment-review";
import { reviewPaymentAction } from "../actions";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseListParams, type ListParams } from "@/lib/utils/list";
import type { Payment } from "@/types/database";

export const metadata: Metadata = { title: "Payments" };

const STATUSES = ["paid", "created", "failed", "cancelled", "refunded"] as const;

type InvoiceRef = { id: string; invoice_number: string };
type Row = Payment & { plan: { name: string } | null; profile: { email: string } | null; invoice: InvoiceRef | InvoiceRef[] | null };

function taxSummary(p: Payment): string | null {
  const gst = (p.cgst_amount ?? 0) + (p.sgst_amount ?? 0) + (p.igst_amount ?? 0);
  if (!p.tax_type || p.tax_type === "none") return null;
  const parts = [`${p.tax_type === "intra_state" ? "CGST+SGST" : "IGST"} ${formatCurrency(gst, p.currency)}`];
  if (p.other_tax_amount) parts.push(`${p.other_tax_name ?? "Other"} ${formatCurrency(p.other_tax_amount, p.currency)}`);
  return parts.join(" · ");
}

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  await requireAdmin();
  const { page, q, status, from, to, pageSize } = parseListParams(await searchParams, STATUSES);
  const db = createAdminClient();
  const byEmail = q.includes("@");

  let query = db
    .from("payments")
    .select(`*, plan:plans(name), invoice:invoices(id, invoice_number), profile:profiles${byEmail ? "!inner" : ""}(email)`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) query = query.eq("status", status);
  if (q && byEmail) query = query.ilike("profile.email", `%${q}%`);
  else if (q) query = query.or(`order_id.ilike.%${q}%,payment_id.ilike.%${q}%`);
  const { data, count } = await query;
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <>
      <PageHeader title="Payments" description="Razorpay orders and their verified outcomes." />
      <Card className="overflow-hidden">
        <TableToolbar
          placeholder="Search email, order or payment ID…"
          filters={[
            { value: "paid", label: "Successful" },
            { value: "created", label: "Pending" },
            { value: "failed", label: "Failed" },
            { value: "cancelled", label: "Cancelled" },
            { value: "refunded", label: "Refunded" },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState title="No payments found" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>User</TH>
                <TH>Plan</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH>Order / Payment</TH>
                <TH className="text-right">Review</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((p) => (
                <TR key={p.id}>
                  <TD className="whitespace-nowrap text-muted">{formatDate(p.created_at, true)}</TD>
                  <TD>
                    <Link href={`/admin/users/${p.user_id}`} className="hover:underline">
                      {p.profile?.email ?? p.user_id.slice(0, 8)}
                    </Link>
                  </TD>
                  <TD>
                    {p.plan_name ?? p.plan?.name ?? "—"} <span className="text-xs capitalize text-muted">({p.billing_cycle})</span>
                  </TD>
                  <TD className="whitespace-nowrap">
                    {formatCurrency(p.amount, p.currency)}
                    {p.discount_amount > 0 && <span className="block text-xs text-success">−{formatCurrency(p.discount_amount, p.currency)} coupon</span>}
                    {taxSummary(p) && <span className="block text-xs text-muted">{taxSummary(p)}</span>}
                  </TD>
                  <TD>
                    <StatusBadge status={p.status} />
                    {p.failure_reason && <span className="mt-1 block max-w-48 truncate text-xs text-muted" title={p.failure_reason}>{p.failure_reason}</span>}
                  </TD>
                  <TD className="font-mono text-xs text-muted">
                    <span className="block">{p.order_id}</span>
                    {p.payment_id && <span className="block">{p.payment_id}</span>}
                    {(() => {
                      const invoice = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice;
                      return invoice ? (
                        <Link href={`/invoices/${invoice.id}`} className="mt-0.5 block font-sans text-foreground hover:underline">
                          {invoice.invoice_number}
                        </Link>
                      ) : null;
                    })()}
                  </TD>
                  <TD className="text-right">
                    <PaymentReviewButton
                      action={reviewPaymentAction}
                      paymentId={p.id}
                      canRefund={p.status === "paid"}
                      reviewed={Boolean((p.metadata as { reviewed_at?: string }).reviewed_at)}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} />
      </Card>
    </>
  );
}
