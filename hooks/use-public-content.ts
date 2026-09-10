"use client";

import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { defaultCompany } from "@/lib/content/defaults";
import { mapPricingPlan, sortPricingPlans } from "@/lib/content/plans";
import { getClientDb } from "@/lib/firebase/client";
import type { CompanyContent, PricingPlan, ShowcaseProject, SupportContent } from "@/types";

export type PublicContent = {
  plans: PricingPlan[];
  projects: ShowcaseProject[];
  support: SupportContent | null;
  company: CompanyContent;
};

async function readPlansFromClient(): Promise<PricingPlan[]> {
  const db = getClientDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, "about", "pricing", "plans"));
  return sortPricingPlans(
    snap.docs
      .map((doc) => mapPricingPlan(doc.id, doc.data() as Record<string, unknown>))
      .filter((plan) => plan.active),
  );
}

export function usePublicContent() {
  const [data, setData] = useState<PublicContent>({
    plans: [],
    projects: [],
    support: null,
    company: defaultCompany(),
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/content")
      .then((res) => res.json())
      .then(async (payload) => {
        let plans: PricingPlan[] = payload.plans ?? [];
        if (plans.length === 0) {
          plans = await readPlansFromClient();
        }
        if (cancelled) return;
        setData({
          plans,
          projects: payload.projects ?? [],
          support: payload.support ?? null,
          company: payload.company ?? defaultCompany(),
        });
      })
      .catch(async () => {
        const plans = await readPlansFromClient();
        if (!cancelled) setData((current) => ({ ...current, plans }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, loading };
}
