import { listPlansFromFirestoreRest, getPlanFromFirestoreRest } from "@/lib/content/firestore-rest";
import { mapPricingPlan, sortPricingPlans } from "@/lib/content/plans";
import { defaultCompany } from "@/lib/content/defaults";
import { tryGetAdminDb } from "@/lib/firebase/admin";
import { aboutDocs, collections, pricingPlansPath, showcaseProjectsPath } from "@/lib/firebase/collections";
import type { CompanyContent, PricingPlan, ShowcaseProject, SupportContent } from "@/types";

export { defaultCompany };

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
  if (db) {
    try {
      const snap = await db.collection(pricingPlansPath()).get();
      return sortPricingPlans(
        snap.docs
          .map((doc) => mapPricingPlan(doc.id, doc.data()))
          .filter((plan) => plan.active),
      );
    } catch {
      // Fall through to the public Firestore REST catalog.
    }
  }
  return listPlansFromFirestoreRest();
}

export async function getPlanById(planId: string): Promise<PricingPlan | null> {
  const db = tryGetAdminDb();
  if (db) {
    try {
      const snap = await db.collection(pricingPlansPath()).doc(planId).get();
      if (snap.exists) return mapPricingPlan(snap.id, snap.data() ?? {});
    } catch {
      // Fall through to the public Firestore REST catalog.
    }
  }
  return getPlanFromFirestoreRest(planId);
}

export async function getPlanByRazorpayPlanId(razorpayPlanId: string): Promise<PricingPlan | null> {
  const id = razorpayPlanId.trim();
  if (!id) return null;
  const plans = await getActivePlans();
  return plans.find((plan) => plan.razorpayPlanId === id) ?? null;
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
