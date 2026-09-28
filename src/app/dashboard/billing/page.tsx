import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, FileText, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList, PageHeader } from "@/components/ui/misc";
import { Alert, EmptyState, ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BillingPlans } from "@/components/billing/billing-plans";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveSubscription } from "@/lib/data/subscriptions";
import { getActivePlans } from "@/lib/data/plans";
import { getUsageSnapshot } from "@/lib/data/limits";
import { getPlatformSettings } from "@/lib/data/settings";
import { getIntegrationStatus } from "@/lib/env";
import { getBillingProfile } from "@/lib/billing/checkout";
import { daysUntil, formatCurrency, formatDate, formatLimit } from "@/lib/utils";
import type { Payment } from "@/types/database";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string; welcome?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createClient();

  const [effective, plansResult, usage, settings, paymentsRes, savedProfile] = await Promise.all([
    getEffectiveSubscription(user.id),
    getActivePlans(),
    getUsageSnapshot(user.id),
    getPlatformSettings(),
    supabase
      .from("payments")
      .select("*, plan:plans(name), invoice:invoices(id, invoice_number)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    getBillingProfile(user.id),
  ]);
  type InvoiceRef = { id: string; invoice_number: string };
  const payments = ((paymentsRes.data as (Payment & { plan: { name: string } | null; invoice: InvoiceRef | InvoiceRef[] | null })[]) ?? []).map(
    (p) => ({ ...p, invoice: Array.isArray(p.invoice) ? (p.invoice[0] ?? null) : p.invoice }),
  );
  const { subscription, plan } = effective;
  const isPaid = Boolean(subscription && subscription.billing_cycle !== "free");
  const lastPaid = payments.find((p) => p.status === "paid" && p.subscription_id === subscription?.id);
  const daysLeft = daysUntil(subscription?.current_period_end);

  return (
    <>
      <PageHeader title="Billing" description="Manage your plan and view payment history." />

      {params.welcome === "1" && (
        <Alert tone="success" className="mb-6">
          Welcome to {settings.platform_name}! You&apos;re on the {plan?.name ?? "default"} plan. Upgrade any time below.
        </Alert>
      )}
      {daysLeft !== null && daysLeft <= 7 && (
        <Alert tone="warning" className="mb-6">
          Your {plan?.name} plan ends in {daysLeft} day{daysLeft === 1 ? "" : "s"}. Renew to keep your current limits.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Current Plan" />
          <CardContent>
            <DescriptionList
              items={[
                { label: "Plan", value: plan?.name ?? "No plan" },
                {
                  label: "Status",
                  value: subscription ? <StatusBadge status={subscription.status} /> : <span className="text-muted">Default plan</span>,
                },
                { label: "Billing Cycle", value: <span className="capitalize">{subscription?.billing_cycle ?? "free"}</span> },
                {
                  label: "Amount",
                  value: lastPaid ? formatCurrency(lastPaid.amount, lastPaid.currency) : formatCurrency(0, plan?.currency ?? "INR"),
                },
                { label: "Period Started", value: formatDate(subscription?.current_period_start) },
                { label: isPaid ? "Valid Until" : "Renewal", value: subscription?.current_period_end ? formatDate(subscription.current_period_end) : "No expiry" },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Usage this month" />
          <CardContent className="space-y-4">
            <UsageBar label="Projects" used={usage.projects} limit={plan?.max_projects ?? null} />
            <UsageBar label="Deployments" used={usage.deploymentsThisMonth} limit={plan?.max_deployments_per_month ?? null} />
            <UsageBar label="Domains" used={usage.domains} limit={plan?.max_domains ?? null} />
          </CardContent>
        </Card>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-base font-semibold text-foreground">Plans</h2>
        {plansResult.error ? (
          <Card>
            <ErrorState description="Plans could not be loaded. Please try again later." />
          </Card>
        ) : (
          <BillingPlans
            plans={plansResult.plans}
            currentPlanId={subscription ? plan?.id ?? null : null}
            currentIsPaid={isPaid}
            razorpayConfigured={getIntegrationStatus().razorpay}
            initialPlanSlug={params.plan}
            initialCycle={params.cycle === "yearly" ? "yearly" : params.cycle === "monthly" ? "monthly" : undefined}
            platformName={settings.platform_name}
            savedProfile={savedProfile}
            defaults={{ name: user.profile.name ?? "", email: user.email }}
          />
        )}
      </section>

      <Card className="mt-10 overflow-hidden">
        <CardHeader title="Payment History" description="Every order created from your account." />
        {payments.length === 0 ? (
          <EmptyState icon={<Receipt className="h-5 w-5" />} title="No payments yet" description="Payments for paid plans will appear here." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Plan</TH>
                <TH>Cycle</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH>Reference</TH>
                <TH>Invoice</TH>
              </tr>
            </THead>
            <TBody>
              {payments.map((p) => (
                <TR key={p.id}>
                  <TD className="text-muted">{formatDate(p.created_at, true)}</TD>
                  <TD>{p.plan_name ?? p.plan?.name ?? "—"}</TD>
                  <TD className="capitalize text-muted">{p.billing_cycle}</TD>
                  <TD>
                    {formatCurrency(p.amount, p.currency)}
                    {p.discount_amount > 0 && <span className="ml-1 text-xs text-success">(−{formatCurrency(p.discount_amount, p.currency)})</span>}
                  </TD>
                  <TD>
                    <StatusBadge status={p.status} />
                  </TD>
                  <TD className="font-mono text-xs text-muted">{p.payment_id ?? p.order_id}</TD>
                  <TD>
                    {p.invoice ? (
                      <Link href={`/invoices/${p.invoice.id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground hover:underline">
                        <FileText className="h-3.5 w-3.5" /> {p.invoice.invoice_number}
                      </Link>
                    ) : (
                      <span className="text-muted-soft">—</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-soft">
        <CreditCard className="h-3.5 w-3.5" />
        Questions about a charge?{" "}
        <Link href="/dashboard/support" className="underline hover:text-foreground">
          Contact support
        </Link>{" "}
        · <Link href="/refund-policy" className="underline hover:text-foreground">Refund Policy</Link>
      </p>
    </>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit === null ? 0 : limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[13px]">
        <span className="text-foreground">{label}</span>
        <span className="text-muted">
          {used} / {formatLimit(limit)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background-subtle">
        <div
          className={pct >= 100 ? "h-full bg-danger" : pct >= 80 ? "h-full bg-warning" : "h-full bg-accent"}
          style={{ width: limit === null ? "4%" : `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}
