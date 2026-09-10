import { differenceInCalendarDays } from "date-fns";
import {
  DEFAULT_GRACE_PERIOD_DAYS,
  DEPLOYABLE_SUBSCRIPTION_STATUSES,
  HOSTED_PROJECT_STATUSES,
} from "@/config/constants";
import { getPlanById } from "@/lib/content/public";
import { AppError } from "@/lib/errors";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections, userProjectsPath } from "@/lib/firebase/collections";
import type { PlanFeatures, PricingPlan, ProjectStatus, UserProfile } from "@/types";

export async function getUserProfile(uid: string): Promise<UserProfile> {
  const db = getAdminDb();
  const snap = await db.collection(collections.users).doc(uid).get();
  if (!snap.exists) {
    throw new AppError("NOT_FOUND", "User profile was not found.", 404);
  }
  return snap.data() as UserProfile;
}

export async function getCurrentUsage(uid: string) {
  const db = getAdminDb();
  const snap = await db.collection(userProjectsPath(uid)).get();
  const hosted = snap.docs.filter((doc) => {
    const status = String(doc.data().status) as ProjectStatus;
    const counts = doc.data().countsTowardLimit !== false;
    return counts && HOSTED_PROJECT_STATUSES.includes(status as (typeof HOSTED_PROJECT_STATUSES)[number]);
  });
  return hosted.length;
}

export function getWebsiteLimit(user: UserProfile, plan?: PricingPlan | null) {
  if (plan && Number.isFinite(plan.maxWebsites)) return plan.maxWebsites;
  return user.websiteLimit ?? 0;
}

export function isWithinGrace(user: UserProfile) {
  if (user.subscriptionStatus !== "past_due") return false;
  if (!user.renewalDate) return false;
  const grace = user.gracePeriodDays || DEFAULT_GRACE_PERIOD_DAYS;
  const daysPast = differenceInCalendarDays(new Date(), new Date(user.renewalDate));
  return daysPast <= grace;
}

export function isSubscriptionEligible(user: UserProfile) {
  if (user.subscriptionStatus === "active" || user.subscriptionStatus === "authenticated") {
    return true;
  }
  if (user.subscriptionStatus === "past_due" && isWithinGrace(user)) {
    return true;
  }
  return DEPLOYABLE_SUBSCRIPTION_STATUSES.includes(
    user.subscriptionStatus as (typeof DEPLOYABLE_SUBSCRIPTION_STATUSES)[number],
  ) && isWithinGrace(user);
}

export async function getUserPlan(user: UserProfile) {
  if (!user.activePlanId) return null;
  return getPlanById(user.activePlanId);
}

export function hasFeature(plan: PricingPlan | null, feature: keyof PlanFeatures) {
  if (!plan) return false;
  if (feature === "customDomains" || feature === "customDomain") {
    return Boolean(plan.features.customDomain || plan.features.customDomains);
  }
  const value = plan.features[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.length > 0;
  return Boolean(value);
}

export async function assertSubscriptionEligible(uid: string) {
  const user = await getUserProfile(uid);
  const plan = await getUserPlan(user);
  if (!isSubscriptionEligible(user)) {
    throw new AppError(
      "SUBSCRIPTION_INACTIVE",
      "Your subscription is not active. Update billing to deploy websites.",
      402,
      { subscriptionStatus: user.subscriptionStatus },
    );
  }
  if (plan && !hasFeature(plan, "githubDeployment")) {
    throw new AppError(
      "PLAN_FEATURE",
      "GitHub deployment is not included in your current plan.",
      403,
      { feature: "githubDeployment" },
    );
  }
  return { user, plan };
}

export async function canDeploy(uid: string) {
  const { user, plan } = await assertSubscriptionEligible(uid);
  const usage = await getCurrentUsage(uid);
  const limit = getWebsiteLimit(user, plan);
  if (usage >= limit) {
    throw new AppError(
      "PLAN_LIMIT",
      `You've reached your current plan limit. Upgrade your plan to deploy more websites.`,
      403,
      {
        used: usage,
        limit,
        planName: plan?.planName ?? user.activePlanName ?? "current",
      },
    );
  }
  return { user, plan, usage, limit };
}

export async function canUseCustomDomain(uid: string) {
  const user = await getUserProfile(uid);
  const plan = await getUserPlan(user);
  if (!isSubscriptionEligible(user)) {
    throw new AppError(
      "SUBSCRIPTION_INACTIVE",
      "Your subscription is not active. Update billing to manage custom domains.",
      402,
    );
  }
  if (!plan || !hasFeature(plan, "customDomain")) {
    throw new AppError(
      "PLAN_FEATURE",
      "Custom domains are not included in your current plan. Upgrade to connect your own domain.",
      403,
      { feature: "customDomain" },
    );
  }
  return { user, plan };
}

export async function canUseFreeSubdomain(uid: string) {
  const user = await getUserProfile(uid);
  const plan = await getUserPlan(user);
  if (!isSubscriptionEligible(user)) {
    throw new AppError(
      "SUBSCRIPTION_INACTIVE",
      "Your subscription is not active. Update billing to use a Vivexa subdomain.",
      402,
    );
  }
  if (!plan || !hasFeature(plan, "freeSubdomain")) {
    throw new AppError(
      "PLAN_FEATURE",
      "A free Vivexa subdomain is not included in your current plan.",
      403,
      { feature: "freeSubdomain" },
    );
  }
  return { user, plan };
}

export async function assertWebsiteKind(uid: string, kind: "static" | "dynamic") {
  const user = await getUserProfile(uid);
  const plan = await getUserPlan(user);
  if (!plan) {
    throw new AppError("PLAN_FEATURE", "Choose a plan before deploying a website.", 403, { feature: kind });
  }
  if (kind === "dynamic" && !hasFeature(plan, "dynamicWebsite")) {
    throw new AppError(
      "PLAN_FEATURE",
      "Dynamic websites are not included in your current plan. Upgrade to deploy dynamic sites.",
      403,
      { feature: "dynamicWebsite" },
    );
  }
  if (kind === "static" && !hasFeature(plan, "staticWebsite")) {
    throw new AppError(
      "PLAN_FEATURE",
      "Static websites are not included in your current plan.",
      403,
      { feature: "staticWebsite" },
    );
  }
  return { user, plan };
}

export async function canUseEnvVars(uid: string) {
  const user = await getUserProfile(uid);
  const plan = await getUserPlan(user);
  if (plan && !hasFeature(plan, "environmentVariables")) {
    throw new AppError(
      "PLAN_FEATURE",
      "Environment variables are not included in your current plan.",
      403,
      { feature: "environmentVariables" },
    );
  }
  return { user, plan };
}

export async function canUseAutoDeploy(uid: string) {
  const user = await getUserProfile(uid);
  const plan = await getUserPlan(user);
  if (!plan || !hasFeature(plan, "automaticDeployments")) {
    throw new AppError(
      "PLAN_FEATURE",
      "Automatic deployments are not included in your current plan.",
      403,
      { feature: "automaticDeployments" },
    );
  }
  return { user, plan };
}

export async function assertMonthlyDeploymentQuota(uid: string, plan: PricingPlan | null) {
  if (!plan?.features.maxDeploymentsPerMonth) return;
  const db = getAdminDb();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const projects = await db.collection(userProjectsPath(uid)).get();
  let used = 0;
  for (const project of projects.docs) {
    const snap = await db
      .collection(`${userProjectsPath(uid)}/${project.id}/${collections.deployments}`)
      .where("createdAt", ">=", start.toISOString())
      .get();
    used += snap.size;
  }
  if (used >= plan.features.maxDeploymentsPerMonth) {
    throw new AppError(
      "PLAN_LIMIT",
      "You have reached this month's deployment limit for your plan.",
      403,
      { used, limit: plan.features.maxDeploymentsPerMonth },
    );
  }
}
