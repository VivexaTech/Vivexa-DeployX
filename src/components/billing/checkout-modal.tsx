"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Download, Lock, Pencil, ShieldCheck, Tag, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/states";
import { loadRazorpayCheckout, type RazorpaySuccess } from "@/components/billing/razorpay";
import { billingDetailsSchema, gstDetailsSchema } from "@/lib/billing/schema";
import { COUNTRIES, INDIAN_STATES, formatRate, gstinStateCode, isValidGstin, normalizeStateCode, stateName } from "@/lib/billing/tax";
import type { SerializedQuote } from "@/lib/billing/checkout";
import { cn, formatMoney } from "@/lib/utils";
import type { BillingProfile, Plan } from "@/types/database";

type Cycle = "monthly" | "yearly";
type Stage = "form" | "processing" | "awaiting" | "verifying" | "success" | "pending";

type BillingForm = {
  full_name: string;
  company_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: "IN";
};
type GstForm = { enabled: boolean; gstin: string; legal_name: string; address: string };

type SuccessInfo = {
  paymentId: string | null;
  amount: number | null;
  currency: string;
  planName: string | null;
  invoice: { id: string; number: string } | null;
};

type OrderResponse = {
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  planName?: string;
  quote?: SerializedQuote;
  prefill?: { name: string; email: string; contact: string };
  error?: string;
};

const cycleLabel = (cycle: Cycle) => (cycle === "yearly" ? "Annual Plan" : "Monthly Plan");

function initialBilling(profile: BillingProfile | null, defaults: { name: string; email: string }): BillingForm {
  return {
    full_name: profile?.full_name ?? defaults.name,
    company_name: profile?.company_name ?? "",
    email: profile?.email ?? defaults.email,
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
    city: profile?.city ?? "",
    state: normalizeStateCode(profile?.state) ?? "",
    postal_code: profile?.postal_code ?? "",
    country: "IN",
  };
}

export function CheckoutModal({
  plan,
  cycle,
  initialCoupon,
  savedProfile,
  defaults,
  platformName,
  onClose,
  onCompleted,
}: {
  plan: Plan;
  cycle: Cycle;
  initialCoupon: string;
  savedProfile: BillingProfile | null;
  defaults: { name: string; email: string };
  platformName: string;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [billing, setBilling] = useState<BillingForm>(() => initialBilling(savedProfile, defaults));
  const [gst, setGst] = useState<GstForm>(() => ({
    enabled: savedProfile?.gst_enabled ?? false,
    gstin: savedProfile?.gstin ?? "",
    legal_name: savedProfile?.gst_legal_name ?? "",
    address: savedProfile?.gst_address ?? "",
  }));
  const [editing, setEditing] = useState(!savedProfile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [couponInput, setCouponInput] = useState(initialCoupon);
  const [appliedCoupon, setAppliedCoupon] = useState(initialCoupon.trim());
  const [quoteState, setQuoteState] = useState<{ key: string; quote: SerializedQuote | null; error: string | null } | null>(null);
  const [stage, setStage] = useState<Stage>("form");
  const [notice, setNotice] = useState<{ tone: "warning" | "danger"; text: string } | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const stageRef = useRef<Stage>("form");
  const failureRef = useRef<string | null>(null);

  const updateStage = useCallback((next: Stage) => {
    stageRef.current = next;
    setStage(next);
  }, []);

  const busy = stage === "processing" || stage === "awaiting" || stage === "verifying";
  const stateCode = normalizeStateCode(billing.state);
  const quoteKey = `${stateCode ?? ""}|${appliedCoupon}`;
  const current = quoteState?.key === quoteKey ? quoteState : null;
  const quote = current?.quote ?? null;
  const quoteLoading = Boolean(stateCode) && !current;

  const requestClose = useCallback(() => {
    if (stageRef.current === "processing" || stageRef.current === "awaiting" || stageRef.current === "verifying") return;
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [requestClose]);

  // Server-calculated preview; create-order recalculates independently before charging.
  useEffect(() => {
    if (!stateCode) return;
    const controller = new AbortController();
    const key = `${stateCode}|${appliedCoupon}`;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/billing/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: plan.id, cycle, coupon: appliedCoupon || undefined, state: stateCode }),
          signal: controller.signal,
        });
        const data = (await res.json()) as { quote?: SerializedQuote; error?: string };
        if (!res.ok || !data.quote) throw new Error(data.error ?? "Could not calculate the total.");
        setQuoteState({ key, quote: data.quote, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        setQuoteState({ key, quote: null, error: error instanceof Error ? error.message : "Could not calculate the total." });
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [plan.id, cycle, appliedCoupon, stateCode]);

  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  const setField = <K extends keyof BillingForm>(key: K, value: BillingForm[K]) => {
    setBilling((b) => ({ ...b, [key]: value }));
    clearError(key);
  };
  const setGstField = <K extends keyof GstForm>(key: K, value: GstForm[K]) => {
    setGst((g) => ({ ...g, [key]: value }));
    clearError(`gst.${key}`);
  };

  const verify = useCallback(
    async (response: RazorpaySuccess) => {
      updateStage("verifying");
      try {
        const res = await fetch("/api/razorpay/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          }),
        });
        const data = (await res.json()) as SuccessInfo & { status?: string; error?: string };
        if (data.status === "paid") {
          setSuccess(data);
          updateStage("success");
          onCompleted();
        } else if (data.status === "pending") {
          updateStage("pending");
          onCompleted();
        } else {
          updateStage("form");
          setNotice({ tone: "danger", text: data.error ?? "Payment could not be verified. If you were charged, contact support with your order ID." });
        }
      } catch {
        updateStage("pending");
      }
    },
    [onCompleted, updateStage],
  );

  const pay = async () => {
    setNotice(null);
    const nextErrors: Record<string, string> = {};
    const billingCheck = billingDetailsSchema.safeParse(billing);
    if (!billingCheck.success) {
      for (const issue of billingCheck.error.issues) nextErrors[String(issue.path[0])] ??= issue.message;
    }
    const gstCheck = gstDetailsSchema.safeParse(gst);
    if (!gstCheck.success) {
      for (const issue of gstCheck.error.issues) nextErrors[`gst.${String(issue.path[0])}`] ??= issue.message;
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setEditing(true);
      setNotice({ tone: "danger", text: "Please correct the highlighted billing details." });
      return;
    }
    if (!quote) {
      setNotice({ tone: "warning", text: current?.error ?? "Please wait while we calculate your total." });
      return;
    }

    updateStage("processing");
    failureRef.current = null;
    try {
      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, cycle, coupon: appliedCoupon || undefined, billing, gst }),
      });
      const order = (await res.json()) as OrderResponse;
      if (!res.ok || !order.orderId || !order.keyId) throw new Error(order.error ?? "Could not start checkout.");
      if (order.quote) setQuoteState({ key: quoteKey, quote: order.quote, error: null });

      const loaded = await loadRazorpayCheckout();
      if (!loaded || !window.Razorpay) throw new Error("Could not load the payment window. Check your connection and try again.");

      const orderId = order.orderId;
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: orderId,
        amount: order.amount ?? 0,
        currency: order.currency ?? "INR",
        name: platformName,
        description: `${order.planName ?? plan.name} · ${cycleLabel(cycle)}`,
        prefill: order.prefill,
        theme: { color: "#4f46e5" },
        handler: (response) => void verify(response),
        modal: {
          ondismiss: () => {
            if (stageRef.current !== "awaiting") return;
            updateStage("form");
            setNotice(
              failureRef.current
                ? { tone: "danger", text: `Payment failed: ${failureRef.current} You can try again.` }
                : { tone: "warning", text: "Payment was cancelled. You have not been charged." },
            );
            void fetch("/api/razorpay/cancel-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId, reason: failureRef.current ?? undefined }),
            });
          },
        },
      });
      checkout.on("payment.failed", (response) => {
        failureRef.current = response.error?.description ?? "The payment could not be completed.";
      });
      updateStage("awaiting");
      checkout.open();
    } catch (error) {
      updateStage("form");
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Could not start checkout." });
    }
  };

  if (typeof document === "undefined") return null;

  const gstinHint =
    gst.enabled && isValidGstin(gst.gstin) && stateCode && gstinStateCode(gst.gstin) && gstinStateCode(gst.gstin) !== stateCode
      ? `This GSTIN is registered in ${stateName(gstinStateCode(gst.gstin))}. Tax is calculated from your billing state (${stateName(stateCode)}).`
      : undefined;

  const payLabel = stage === "processing" ? "Preparing payment…" : stage === "awaiting" ? "Complete payment in the Razorpay window" : stage === "verifying" ? "Verifying payment…" : "Continue to Payment";

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-stretch justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[2px]" onClick={requestClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="relative flex h-[100dvh] w-full animate-slide-up flex-col overflow-hidden border-border bg-popover shadow-card sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-2xl sm:border"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 id="checkout-title" className="text-base font-semibold text-foreground">
              {stage === "success" ? "Payment successful" : "Checkout"}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">
              {plan.name} · {cycleLabel(cycle)}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            className="rounded-md p-1 text-muted transition-colors hover:bg-background-subtle hover:text-foreground disabled:opacity-40"
            aria-label="Close checkout"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {stage === "success" && success ? (
          <SuccessView info={success} plan={plan} cycle={cycle} />
        ) : stage === "pending" ? (
          <PendingView />
        ) : (
          <>
            <div className="scrollbar-thin flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
              <div className="scrollbar-thin space-y-6 p-5 sm:p-6 lg:overflow-y-auto">
                {notice && (
                  <div role="alert">
                    <Alert tone={notice.tone}>{notice.text}</Alert>
                  </div>
                )}

                <section aria-labelledby="billing-heading">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 id="billing-heading" className="text-sm font-semibold text-foreground">
                      Billing Details
                    </h3>
                    {savedProfile && !editing && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={busy}>
                        <Pencil className="h-3.5 w-3.5" /> Edit Billing Details
                      </Button>
                    )}
                  </div>
                  {savedProfile && !editing ? (
                    <SavedBilling billing={billing} />
                  ) : (
                    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full name" htmlFor="co-name" error={errors.full_name}>
                        <Input id="co-name" autoComplete="name" value={billing.full_name} onChange={(e) => setField("full_name", e.target.value)} aria-invalid={Boolean(errors.full_name)} />
                      </Field>
                      <Field label="Company name (optional)" htmlFor="co-company" error={errors.company_name}>
                        <Input id="co-company" autoComplete="organization" value={billing.company_name} onChange={(e) => setField("company_name", e.target.value)} />
                      </Field>
                      <Field label="Email" htmlFor="co-email" error={errors.email}>
                        <Input id="co-email" type="email" autoComplete="email" value={billing.email} onChange={(e) => setField("email", e.target.value)} aria-invalid={Boolean(errors.email)} />
                      </Field>
                      <Field label="Phone" htmlFor="co-phone" error={errors.phone}>
                        <Input id="co-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" value={billing.phone} onChange={(e) => setField("phone", e.target.value)} aria-invalid={Boolean(errors.phone)} />
                      </Field>
                      <Field label="Address" htmlFor="co-address" error={errors.address} className="sm:col-span-2">
                        <Input id="co-address" autoComplete="street-address" placeholder="Building, street, area" value={billing.address} onChange={(e) => setField("address", e.target.value)} aria-invalid={Boolean(errors.address)} />
                      </Field>
                      <Field label="City" htmlFor="co-city" error={errors.city}>
                        <Input id="co-city" autoComplete="address-level2" value={billing.city} onChange={(e) => setField("city", e.target.value)} aria-invalid={Boolean(errors.city)} />
                      </Field>
                      <Field label="State / Union territory" htmlFor="co-state" error={errors.state}>
                        <Select id="co-state" autoComplete="address-level1" value={billing.state} onChange={(e) => setField("state", e.target.value)} aria-invalid={Boolean(errors.state)}>
                          <option value="">Select state</option>
                          {INDIAN_STATES.map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="PIN code" htmlFor="co-pin" error={errors.postal_code}>
                        <Input id="co-pin" autoComplete="postal-code" inputMode="numeric" maxLength={6} value={billing.postal_code} onChange={(e) => setField("postal_code", e.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(errors.postal_code)} />
                      </Field>
                      <Field label="Country" htmlFor="co-country" hint="Billing is currently available for Indian addresses.">
                        <Select id="co-country" value={billing.country} onChange={() => undefined}>
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </fieldset>
                  )}
                  {savedProfile && editing && (
                    <p className="mt-3 text-xs text-muted">Changes are saved to your billing profile when you continue to payment.</p>
                  )}
                </section>

                <section aria-labelledby="gst-heading" className="border-t border-border pt-6">
                  <h3 id="gst-heading" className="text-sm font-semibold text-foreground">
                    GST Details
                  </h3>
                  <fieldset disabled={busy} className="mt-3">
                    <legend className="mb-2 text-[13px] text-muted">Do you have GST details?</legend>
                    <div className="flex gap-2">
                      {[
                        { value: false, label: "No" },
                        { value: true, label: "Yes" },
                      ].map((option) => (
                        <label
                          key={option.label}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-sm transition-colors",
                            gst.enabled === option.value ? "border-foreground/50 bg-background-subtle text-foreground" : "border-border text-muted hover:border-border-strong",
                          )}
                        >
                          <input type="radio" name="gst-enabled" className="accent-[var(--accent)]" checked={gst.enabled === option.value} onChange={() => setGstField("enabled", option.value)} />
                          {option.label}
                        </label>
                      ))}
                    </div>
                    {gst.enabled && (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Field label="GSTIN" htmlFor="co-gstin" error={errors["gst.gstin"]} hint={gstinHint}>
                          <Input
                            id="co-gstin"
                            value={gst.gstin}
                            maxLength={15}
                            placeholder="22AAAAA0000A1Z5"
                            className="font-mono uppercase"
                            onChange={(e) => setGstField("gstin", e.target.value.toUpperCase().replace(/\s/g, ""))}
                            aria-invalid={Boolean(errors["gst.gstin"])}
                          />
                        </Field>
                        <Field label="Legal / registered business name" htmlFor="co-gst-name" error={errors["gst.legal_name"]}>
                          <Input id="co-gst-name" value={gst.legal_name} onChange={(e) => setGstField("legal_name", e.target.value)} aria-invalid={Boolean(errors["gst.legal_name"])} />
                        </Field>
                        <Field label="GST registered address (optional)" htmlFor="co-gst-address" error={errors["gst.address"]} className="sm:col-span-2">
                          <Textarea id="co-gst-address" rows={2} className="min-h-0" value={gst.address} onChange={(e) => setGstField("address", e.target.value)} />
                        </Field>
                      </div>
                    )}
                  </fieldset>
                </section>
              </div>

              <aside className="scrollbar-thin border-t border-border bg-background-subtle p-5 sm:p-6 lg:overflow-y-auto lg:border-t-0 lg:border-l">
                <OrderSummary plan={plan} cycle={cycle} quote={quote} loading={quoteLoading} error={current?.error ?? null} hasState={Boolean(stateCode)} />

                <div className="mt-5">
                  <label htmlFor="co-coupon" className="mb-1.5 block text-[13px] font-medium text-foreground">
                    Coupon
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-soft" />
                      <Input
                        id="co-coupon"
                        value={couponInput}
                        maxLength={40}
                        disabled={busy}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Optional"
                        className="pl-8 font-mono text-[13px] uppercase"
                      />
                    </div>
                    {appliedCoupon && appliedCoupon === couponInput.trim() ? (
                      <Button variant="outline" disabled={busy} onClick={() => { setCouponInput(""); setAppliedCoupon(""); }}>
                        Remove
                      </Button>
                    ) : (
                      <Button variant="outline" disabled={busy || !couponInput.trim()} onClick={() => setAppliedCoupon(couponInput.trim())}>
                        Apply
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-6 hidden lg:block">
                  <Button className="w-full" size="lg" onClick={pay} loading={busy} disabled={busy || (Boolean(stateCode) && !quote && !current?.error)}>
                    {payLabel}
                  </Button>
                  <SecureNote />
                </div>
              </aside>
            </div>

            <footer className="border-t border-border bg-popover px-5 py-3 lg:hidden">
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="text-muted">Total</span>
                <span className="font-semibold text-foreground">{quote ? formatMoney(quote.totalAmount, quote.currency) : "—"}</span>
              </div>
              <Button className="w-full" size="lg" onClick={pay} loading={busy} disabled={busy || (Boolean(stateCode) && !quote && !current?.error)}>
                {payLabel}
              </Button>
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function SavedBilling({ billing }: { billing: BillingForm }) {
  return (
    <div className="rounded-xl border border-border bg-background-subtle p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> Using saved billing details
      </p>
      <address className="text-[13px] leading-relaxed text-foreground not-italic">
        <span className="font-medium">{billing.full_name}</span>
        {billing.company_name && <span className="block text-muted">{billing.company_name}</span>}
        <span className="block text-muted">{billing.address}</span>
        <span className="block text-muted">
          {billing.city}, {stateName(billing.state)} {billing.postal_code} · India
        </span>
        <span className="mt-1 block text-muted">
          {billing.email} · {billing.phone}
        </span>
      </address>
    </div>
  );
}

function SummaryRow({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 text-[13px]", strong && "text-base")}>
      <dt className={cn(muted ? "text-muted" : "text-foreground", strong && "font-semibold")}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "font-semibold text-foreground" : muted ? "text-muted" : "text-foreground")}>{value}</dd>
    </div>
  );
}

function OrderSummary({
  plan,
  cycle,
  quote,
  loading,
  error,
  hasState,
}: {
  plan: Plan;
  cycle: Cycle;
  quote: SerializedQuote | null;
  loading: boolean;
  error: string | null;
  hasState: boolean;
}) {
  const base = cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">Order Summary</h3>
      <div className="mt-3 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">{plan.name}</p>
        <p className="text-xs text-muted">{cycleLabel(cycle)}</p>
        <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">
          {formatMoney(base, plan.currency)} <span className="text-[13px] font-normal text-muted">/ {cycle === "yearly" ? "year" : "month"}</span>
        </p>
      </div>

      <dl className={cn("mt-4 space-y-2.5", loading && "animate-pulse opacity-60")} aria-live="polite">
        <SummaryRow label={`${plan.name} ${cycle === "yearly" ? "Annual" : "Monthly"}`} value={formatMoney(quote?.baseAmount ?? base, plan.currency)} />
        {quote && quote.discountAmount > 0 && (
          <SummaryRow label={`Discount${quote.couponCode ? ` (${quote.couponCode})` : ""}`} value={`−${formatMoney(quote.discountAmount, quote.currency)}`} muted />
        )}
        {quote ? (
          <>
            {quote.taxType === "intra_state" ? (
              <>
                <SummaryRow label={`CGST ${formatRate(quote.cgstRate)}%`} value={formatMoney(quote.cgstAmount, quote.currency)} muted />
                <SummaryRow label={`SGST ${formatRate(quote.sgstRate)}%`} value={formatMoney(quote.sgstAmount, quote.currency)} muted />
              </>
            ) : (
              <SummaryRow label={`IGST ${formatRate(quote.igstRate)}%`} value={formatMoney(quote.igstAmount, quote.currency)} muted />
            )}
            {quote.otherTaxRate > 0 && (
              <SummaryRow label={`${quote.otherTaxName} ${formatRate(quote.otherTaxRate)}%`} value={formatMoney(quote.otherTaxAmount, quote.currency)} muted />
            )}
          </>
        ) : (
          <p className="text-xs text-muted">
            {error ? (
              <span className="flex items-start gap-1.5 text-danger">
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {error}
              </span>
            ) : hasState ? (
              "Calculating taxes…"
            ) : (
              "Select your billing state to calculate taxes."
            )}
          </p>
        )}
        <div className="border-t border-border pt-3">
          <SummaryRow label="Total" value={quote ? formatMoney(quote.totalAmount, quote.currency) : "—"} strong />
        </div>
      </dl>
    </div>
  );
}

function SecureNote() {
  return (
    <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
      <Lock className="mt-px h-3 w-3 shrink-0" />
      Payments are processed securely by Razorpay. The final amount is calculated on our servers. Plans are prepaid and do not renew automatically.
    </p>
  );
}

function SuccessView({ info, plan, cycle }: { info: SuccessInfo; plan: Plan; cycle: Cycle }) {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto p-6 sm:p-10">
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-foreground">Your plan is active</h3>
        <p className="mt-1 text-sm text-muted">Payment verified. Thank you for your purchase.</p>
      </div>
      <dl className="mx-auto mt-6 max-w-md space-y-2.5 rounded-xl border border-border bg-background-subtle p-4">
        <SummaryRow label="Plan" value={`${info.planName ?? plan.name} · ${cycleLabel(cycle)}`} />
        <SummaryRow label="Amount paid" value={info.amount !== null ? formatMoney(info.amount, info.currency) : "—"} />
        <SummaryRow label="Payment ID" value={info.paymentId ?? "—"} muted />
        <SummaryRow label="Invoice number" value={info.invoice?.number ?? "Being prepared"} muted />
      </dl>
      {!info.invoice && (
        <p className="mx-auto mt-3 max-w-md text-center text-xs text-muted">Your invoice is being prepared and will appear in your billing history shortly.</p>
      )}
      <div className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row">
        {info.invoice && (
          <ButtonLink href={`/invoices/${info.invoice.id}`} variant="outline" className="flex-1">
            <Download className="h-4 w-4" /> Download Invoice
          </ButtonLink>
        )}
        <ButtonLink href="/dashboard" className="flex-1">
          Go to Dashboard <ArrowRight className="h-4 w-4" />
        </ButtonLink>
      </div>
    </div>
  );
}

function PendingView() {
  return (
    <div className="flex-1 p-6 text-center sm:p-10">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <Clock className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-foreground">Payment is being confirmed</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        We&apos;ve received your payment and are waiting for final confirmation from Razorpay. Your plan and invoice will be ready automatically — you can safely close this window.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/dashboard/billing" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-background-subtle">
          <ShieldCheck className="h-4 w-4" /> View billing
        </Link>
      </div>
    </div>
  );
}
