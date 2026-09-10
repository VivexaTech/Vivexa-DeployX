import { DEFAULT_PLAN_FEATURES } from "@/config/constants";
import type { PlanFeatures, PricingPlan } from "@/types";

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

export function normalizePlanFeatures(raw?: unknown): PlanFeatures {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const customDomain = asBoolean(source.customDomain ?? source.customDomains, DEFAULT_PLAN_FEATURES.customDomain);
  return {
    freeSubdomain: asBoolean(source.freeSubdomain, DEFAULT_PLAN_FEATURES.freeSubdomain),
    customDomain,
    customDomains: customDomain,
    staticWebsite: asBoolean(source.staticWebsite, DEFAULT_PLAN_FEATURES.staticWebsite),
    dynamicWebsite: asBoolean(source.dynamicWebsite, DEFAULT_PLAN_FEATURES.dynamicWebsite),
    githubDeployment: asBoolean(source.githubDeployment, DEFAULT_PLAN_FEATURES.githubDeployment),
    environmentVariables: asBoolean(source.environmentVariables, DEFAULT_PLAN_FEATURES.environmentVariables),
    automaticDeployments: asBoolean(source.automaticDeployments, DEFAULT_PLAN_FEATURES.automaticDeployments),
    teamMembers: Number(source.teamMembers ?? DEFAULT_PLAN_FEATURES.teamMembers),
    maxDeploymentsPerMonth:
      source.maxDeploymentsPerMonth == null || source.maxDeploymentsPerMonth === ""
        ? null
        : Number(source.maxDeploymentsPerMonth),
    supportLevel: String(source.supportLevel ?? DEFAULT_PLAN_FEATURES.supportLevel),
  };
}

export function mapPricingPlan(id: string, data: Record<string, unknown>): PricingPlan {
  const duration = String(data.duration ?? data.billingCycle ?? "yearly");
  const yearly = duration.toLowerCase().includes("year") || data.billingCycle === "yearly";
  return {
    id,
    planName: String(data.planName ?? "Plan"),
    planPrice: Number(data.planPrice ?? 0),
    currency: String(data.currency ?? "INR"),
    keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints.map(String) : [],
    maxWebsites: Number(data.maxWebsites ?? 0),
    duration,
    billingCycle: yearly ? "yearly" : "monthly",
    razorpayPlanId: String(data.razorpayPlanId ?? ""),
    active: data.active !== false,
    displayOrder: Number(data.displayOrder ?? 0),
    features: normalizePlanFeatures(data.features),
    gracePeriodDays: Number(data.gracePeriodDays ?? 3),
  };
}

export function sortPricingPlans(plans: PricingPlan[]) {
  return [...plans].sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) return left.displayOrder - right.displayOrder;
    return left.planName.localeCompare(right.planName);
  });
}
