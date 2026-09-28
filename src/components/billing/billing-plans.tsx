"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ConfigNotice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { CheckoutModal } from "@/components/billing/checkout-modal";
import { cn, formatCurrency, formatLimit } from "@/lib/utils";
import type { BillingProfile, Plan } from "@/types/database";

type Cycle = "monthly" | "yearly";

const isFreePlan = (plan: Plan) => plan.price_monthly === 0 && plan.price_yearly === 0;

export function BillingPlans({
  plans,
  currentPlanId,
  currentIsPaid,
  razorpayConfigured,
  initialPlanSlug,
  initialCycle,
  platformName,
  savedProfile,
  defaults,
}: {
  plans: Plan[];
  currentPlanId: string | null;
  currentIsPaid: boolean;
  razorpayConfigured: boolean;
  initialPlanSlug?: string;
  initialCycle?: Cycle;
  platformName: string;
  savedProfile: BillingProfile | null;
  defaults: { name: string; email: string };
}) {
  const router = useRouter();
  const toast = useToast();
  const [cycle, setCycle] = useState<Cycle>(initialCycle ?? "yearly");
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [confirmFree, setConfirmFree] = useState<Plan | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const highlighted = plans.find((p) => p.slug === initialPlanSlug);

  // Arriving from the pricing page with ?plan=… opens checkout for that plan (after hydration).
  useEffect(() => {
    highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const price = highlighted ? (cycle === "yearly" ? highlighted.price_yearly : highlighted.price_monthly) : 0;
    if (!highlighted || isFreePlan(highlighted) || price <= 0 || !razorpayConfigured) return;
    const id = setTimeout(() => setCheckoutPlan(highlighted), 0);
    return () => clearTimeout(id);
    // Only on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchToFree = async (plan: Plan) => {
    setBusyPlan(plan.id);
    try {
      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, cycle }),
      });
      const data = (await res.json()) as { free?: boolean; error?: string };
      if (!res.ok || !data.free) throw new Error(data.error ?? "Could not switch plans");
      toast.success("Plan updated", `You're now on the ${plan.name} plan.`);
      router.refresh();
    } catch (error) {
      toast.error("Could not switch plans", error instanceof Error ? error.message : undefined);
    } finally {
      setBusyPlan(null);
    }
  };

  const choose = (plan: Plan) => {
    if (isFreePlan(plan)) {
      if (currentIsPaid) setConfirmFree(plan);
      else void switchToFree(plan);
      return;
    }
    setCheckoutPlan(plan);
  };

  const closeCheckout = useCallback(() => setCheckoutPlan(null), []);
  const refresh = useCallback(() => router.refresh(), [router]);

  const hasYearly = plans.some((p) => p.price_yearly > 0);

  return (
    <div>
      {!razorpayConfigured && (
        <ConfigNotice
          className="mb-6"
          title="Payments are not configured"
          description="Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to accept payments. Free plans can still be selected."
        />
      )}
      {hasYearly && (
        <div className="mb-6">
          <Tabs
            value={cycle}
            onChange={setCycle}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
          />
        </div>
      )}

      <div className={cn("grid gap-4", plans.length >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3")}>
        {plans.map((plan) => {
          const price = cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
          const isFree = isFreePlan(plan);
          const isCurrent = plan.id === currentPlanId;
          const unavailable = !isFree && (price <= 0 || !razorpayConfigured);
          const label = isCurrent ? (isFree ? "Current plan" : "Renew") : isFree ? "Switch to Free" : `Choose ${plan.name}`;
          return (
            <div
              key={plan.id}
              ref={plan.id === highlighted?.id ? highlightRef : undefined}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-5",
                isCurrent ? "border-accent/60" : plan.id === highlighted?.id ? "border-foreground/40 shadow-card" : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{plan.name}</h3>
                {isCurrent ? <Badge tone="accent">Current</Badge> : plan.is_featured ? <Badge tone="neutral">Popular</Badge> : null}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight text-foreground">{formatCurrency(price, plan.currency)}</span>
                {!isFree && <span className="text-[13px] text-muted">/{cycle === "yearly" ? "year" : "month"}</span>}
              </div>
              {!isFree && <p className="mt-1 text-xs text-muted-soft">+ applicable taxes</p>}
              <ul className="mt-4 space-y-2 text-[13px] text-muted">
                <li className="flex gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" /> {formatLimit(plan.max_projects)} projects
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" /> {formatLimit(plan.max_deployments_per_month)} deployments / month
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" /> {formatLimit(plan.max_domains)} domains
                </li>
                {plan.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-5 w-full"
                variant={isCurrent ? "outline" : plan.is_featured ? "primary" : "secondary"}
                disabled={(isCurrent && isFree) || unavailable || (busyPlan !== null && busyPlan !== plan.id)}
                loading={busyPlan === plan.id}
                onClick={() => choose(plan)}
              >
                {label}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-soft">
        Plans are prepaid for the selected period and do not renew automatically. Renewing the same plan early extends your current period. Taxes are calculated at checkout from your billing address. Payments are processed securely by Razorpay.
      </p>

      {checkoutPlan && (
        <CheckoutModal
          key={`${checkoutPlan.id}:${cycle}`}
          plan={checkoutPlan}
          cycle={cycle}
          initialCoupon=""
          savedProfile={savedProfile}
          defaults={defaults}
          platformName={platformName}
          onClose={closeCheckout}
          onCompleted={refresh}
        />
      )}

      <ConfirmDialog
        open={confirmFree !== null}
        onClose={() => setConfirmFree(null)}
        onConfirm={() => {
          const plan = confirmFree;
          setConfirmFree(null);
          if (plan) void switchToFree(plan);
        }}
        danger
        title="Switch to the Free plan?"
        description="Your paid plan ends immediately and the remaining prepaid period is forfeited. Refunds follow the Refund Policy. Projects above the Free plan limits keep running but you won't be able to create more until you're within limits."
        confirmLabel="Switch to Free"
      />
    </div>
  );
}
