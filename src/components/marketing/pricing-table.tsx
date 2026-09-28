"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatLimit } from "@/lib/utils";
import type { Plan } from "@/types/database";

type Cycle = "monthly" | "yearly";

export function PricingTable({ plans }: { plans: Plan[] }) {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const hasYearly = plans.some((p) => p.price_yearly > 0);

  return (
    <div>
      {hasYearly && (
        <div className="mb-10 flex justify-center">
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
      <div
        className={cn(
          "grid gap-4",
          plans.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : plans.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2",
        )}
      >
        {plans.map((plan) => {
          const price = cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
          const isFree = plan.price_monthly === 0 && plan.price_yearly === 0;
          const href = isFree ? "/auth/register" : `/dashboard/billing?plan=${plan.slug}&cycle=${cycle}`;
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-xl border bg-card p-6 transition-colors",
                plan.is_featured ? "border-foreground/30 shadow-card" : "border-border hover:border-border-strong",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
                {plan.is_featured && <Badge tone="accent">Popular</Badge>}
              </div>
              <p className="mt-1.5 min-h-10 text-[13px] leading-relaxed text-muted">{plan.description}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight text-foreground">
                  {formatCurrency(price, plan.currency)}
                </span>
                {!isFree && <span className="text-sm text-muted">/{cycle === "yearly" ? "year" : "month"}</span>}
              </div>
              {!isFree && <p className="mt-1 text-xs text-muted-soft">+ applicable taxes, calculated at checkout</p>}
              <ButtonLink href={href} variant={plan.is_featured ? "primary" : "outline"} className="mt-6 w-full">
                {isFree ? "Start for free" : `Choose ${plan.name}`}
              </ButtonLink>
              <ul className="mt-6 space-y-2.5 border-t border-border pt-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-[13px] text-muted">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
                    {feature}
                  </li>
                ))}
              </ul>
              <dl className="mt-auto grid grid-cols-2 gap-2 pt-6 text-[11px] text-muted-soft">
                <div>
                  <dt>Projects</dt>
                  <dd className="text-muted">{formatLimit(plan.max_projects)}</dd>
                </div>
                <div>
                  <dt>Deploys / mo</dt>
                  <dd className="text-muted">{formatLimit(plan.max_deployments_per_month)}</dd>
                </div>
                <div>
                  <dt>Domains</dt>
                  <dd className="text-muted">{formatLimit(plan.max_domains)}</dd>
                </div>
                <div>
                  <dt>Bandwidth</dt>
                  <dd className="text-muted">{formatLimit(plan.bandwidth_gb, " GB")}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
