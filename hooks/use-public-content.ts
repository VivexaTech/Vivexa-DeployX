"use client";

import { useEffect, useState } from "react";
import { defaultCompany } from "@/lib/content/defaults";
import type { CompanyContent, PricingPlan, ShowcaseProject, SupportContent } from "@/types";

export type PublicContent = {
  plans: PricingPlan[];
  projects: ShowcaseProject[];
  support: SupportContent | null;
  company: CompanyContent;
};

export function usePublicContent() {
  const [data, setData] = useState<PublicContent>({
    plans: [],
    projects: [],
    support: null,
    company: defaultCompany(),
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/content")
      .then((res) => res.json())
      .then((payload) => {
        setData({
          plans: payload.plans ?? [],
          projects: payload.projects ?? [],
          support: payload.support ?? null,
          company: payload.company ?? defaultCompany(),
        });
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return { ...data, loading };
}
