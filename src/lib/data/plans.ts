import "server-only";
import { cache } from "react";
import { integrations } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "@/types/database";

export type PlansResult = { plans: Plan[]; configured: boolean; error?: string };

function normalizePlan(row: Plan): Plan {
  return { ...row, features: Array.isArray(row.features) ? row.features.map(String) : [] };
}

/** Active plans for the public pricing page, ordered by display_order. */
export const getActivePlans = cache(async (): Promise<PlansResult> => {
  if (!integrations.supabaseAdmin()) return { plans: [], configured: false };
  const { data, error } = await createAdminClient()
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) return { plans: [], configured: true, error: "Unable to load plans right now." };
  return { plans: (data as Plan[]).map(normalizePlan), configured: true };
});

export async function getAllPlans(): Promise<Plan[]> {
  const { data } = await createAdminClient().from("plans").select("*").order("display_order", { ascending: true });
  return ((data as Plan[]) ?? []).map(normalizePlan);
}

export async function getPlanById(id: string): Promise<Plan | null> {
  const { data } = await createAdminClient().from("plans").select("*").eq("id", id).maybeSingle();
  return data ? normalizePlan(data as Plan) : null;
}

export async function getPlanBySlug(slug: string): Promise<Plan | null> {
  const { data } = await createAdminClient().from("plans").select("*").eq("slug", slug).maybeSingle();
  return data ? normalizePlan(data as Plan) : null;
}
