"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/providers/toast-provider";
import { openRazorpayCheckout } from "@/lib/billing/checkout";
import { apiFetch } from "@/lib/api/client";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { usePublicContent } from "@/hooks/use-public-content";
import { formatCurrency, formatDate } from "@/lib/utils";

function BillingInner() {
  const params = useSearchParams();
  const { data, refresh, loading } = useDashboardData();
  const { plans } = usePublicContent();
  const { push } = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.get("checkout") || params.get("pending")) {
      push({ title: "Payment received. Activation is confirmed by webhook, not the checkout window.", tone: "success" });
    }
  }, [params, push]);

  async function subscribe(planId: string) {
    setBusy(true);
    try {
      const path = data?.user.subscriptionId ? "/api/billing/change-plan" : "/api/billing/subscribe";
      const payload = await apiFetch<{
        keyId?: string;
        subscriptionId: string;
        planName?: string;
        name?: string;
        email?: string;
        checkout?: boolean;
        changed?: boolean;
      }>(path, { method: "POST", body: JSON.stringify({ planId }) });
      if (payload.changed) {
        push({ title: "Plan change requested. Webhook confirmation will update limits.", tone: "success" });
        await refresh();
        return;
      }
      if (!payload.keyId || !payload.name || !payload.email || !payload.planName) {
        throw new Error("Checkout is not configured. Add Razorpay keys and try again.");
      }
      await openRazorpayCheckout({
        keyId: payload.keyId,
        subscriptionId: payload.subscriptionId,
        planName: payload.planName,
        name: payload.name,
        email: payload.email,
      });
      push({ title: "Checkout complete. Waiting for Razorpay webhook verification.", tone: "success" });
      await refresh();
    } catch (error) {
      push({ title: error instanceof Error ? error.message : "Checkout failed", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  if (loading || !data) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Billing</h1>
      <Card className="p-5">
        <p className="text-sm text-muted">Current plan</p>
        <h2 className="mt-1 text-2xl font-semibold">{data.user.activePlanName ?? "No active plan"}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={statusTone(data.user.subscriptionStatus)}>{data.user.subscriptionStatus}</Badge>
        </div>
        <p className="mt-3 text-sm text-muted">Renews {formatDate(data.user.renewalDate)}</p>
        <p className="mt-1 text-sm text-muted">
          {data.user.websiteCount} / {data.user.websiteLimit} websites used
        </p>
        {data.user.subscriptionId ? (
          <Button className="mt-4" variant="secondary" onClick={() => setConfirmCancel(true)}>
            Cancel subscription
          </Button>
        ) : null}
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="p-5">
            <h3 className="text-xl font-semibold">{plan.planName}</h3>
            <p className="mt-2 text-2xl">{formatCurrency(plan.planPrice, plan.currency)}</p>
            <p className="text-sm text-muted">{plan.maxWebsites} websites</p>
            <Button className="mt-4 w-full" disabled={busy} onClick={() => void subscribe(plan.id)}>
              {data.user.activePlanId === plan.id ? "Current plan" : "Choose plan"}
            </Button>
          </Card>
        ))}
      </div>
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel subscription?"
        description="Your sites stay deployed. New deployments stop once the subscription is no longer eligible."
        confirmLabel="Cancel subscription"
        danger
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => {
          await apiFetch("/api/billing/cancel", { method: "POST" });
          setConfirmCancel(false);
          await refresh();
        }}
      />
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <BillingInner />
    </Suspense>
  );
}
