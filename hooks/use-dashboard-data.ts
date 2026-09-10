"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { Deployment, PricingPlan, Project, UserProfile } from "@/types";

export type DashboardData = {
  user: UserProfile;
  plan: PricingPlan | null;
  github: { connected: boolean; login: string | null } | null;
  projects: Project[];
  deployments: Deployment[];
  eligible: boolean;
};

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await apiFetch<DashboardData>("/api/me");
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}
