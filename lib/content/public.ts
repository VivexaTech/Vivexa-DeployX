import { DEFAULT_PLAN_FEATURES } from "@/config/constants";
import { defaultCompany } from "@/lib/content/defaults";
import { tryGetAdminDb } from "@/lib/firebase/admin";
import { aboutDocs, collections, pricingPlansPath, showcaseProjectsPath } from "@/lib/firebase/collections";
import type { CompanyContent, PricingPlan, ShowcaseProject, SupportContent } from "@/types";

export { defaultCompany };

function mapPlan(id: string, data: Record<string, unknown>): PricingPlan {
  const features = {
    ...DEFAULT_PLAN_FEATURES,
    ...((data.features as object) ?? {}),
  };
  return {
    id,
    planName: String(data.planName ?? "Plan"),
    planPrice: Number(data.planPrice ?? 0),
    currency: String(data.currency ?? "INR"),
    keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints.map(String) : [],
    maxWebsites: Number(data.maxWebsites ?? 0),
    duration: String(data.duration ?? "monthly"),
    billingCycle: data.billingCycle === "yearly" ? "yearly" : "monthly",
    razorpayPlanId: String(data.razorpayPlanId ?? ""),
    active: data.active !== false,
    displayOrder: Number(data.displayOrder ?? 0),
    features,
    gracePeriodDays: Number(data.gracePeriodDays ?? 3),
  };
}

export async function getSupportContent(): Promise<SupportContent | null> {
  const db = tryGetAdminDb();
  if (!db) return null;
  const snap = await db.collection(collections.about).doc(aboutDocs.support).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
  };
}

export async function getCompanyContent(): Promise<CompanyContent> {
  const db = tryGetAdminDb();
  if (!db) return defaultCompany();
  const snap = await db.collection(collections.about).doc(aboutDocs.company).get();
  if (!snap.exists) return defaultCompany();
  return { ...defaultCompany(), ...(snap.data() as Partial<CompanyContent>) };
}

export async function getActivePlans(): Promise<PricingPlan[]> {
  const db = tryGetAdminDb();
  if (!db) return [];
  const snap = await db.collection(pricingPlansPath()).where("active", "==", true).get();
  return snap.docs
    .map((doc) => mapPlan(doc.id, doc.data()))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function getPlanById(planId: string): Promise<PricingPlan | null> {
  const db = tryGetAdminDb();
  if (!db) return null;
  const snap = await db.collection(pricingPlansPath()).doc(planId).get();
  if (!snap.exists) return null;
  return mapPlan(snap.id, snap.data() ?? {});
}

export async function getShowcaseProjects(): Promise<ShowcaseProject[]> {
  const db = tryGetAdminDb();
  if (!db) return [];
  const snap = await db.collection(showcaseProjectsPath()).get();
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: String(data.title ?? ""),
        description: String(data.description ?? ""),
        image: String(data.image ?? ""),
        projectUrl: String(data.projectURL ?? data.projectUrl ?? ""),
        category: data.category ? String(data.category) : undefined,
        featured: Boolean(data.featured),
        createdAt: String(data.createdAt ?? ""),
      } satisfies ShowcaseProject;
    })
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
}

export async function getReservedSubdomains() {
  const db = tryGetAdminDb();
  if (!db) return [];
  const snap = await db.collection(collections.about).doc(aboutDocs.reservedSubdomains).get();
  const names = snap.data()?.names;
  return Array.isArray(names) ? names.map(String) : [];
}
