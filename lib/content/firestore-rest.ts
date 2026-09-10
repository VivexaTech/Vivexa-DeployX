import { getAppUrl } from "@/lib/env";
import { mapPricingPlan, sortPricingPlans } from "@/lib/content/plans";
import type { PricingPlan } from "@/types";

type RestValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  arrayValue?: { values?: RestValue[] };
  mapValue?: { fields?: Record<string, RestValue> };
};

function decodeValue(value?: RestValue): unknown {
  if (!value) return undefined;
  if (typeof value.stringValue === "string") return value.stringValue;
  if (typeof value.integerValue === "string") return Number(value.integerValue);
  if (typeof value.doubleValue === "number") return value.doubleValue;
  if (typeof value.booleanValue === "boolean") return value.booleanValue;
  if ("nullValue" in value) return null;
  if (value.arrayValue) return (value.arrayValue.values ?? []).map((item) => decodeValue(item));
  if (value.mapValue?.fields) {
    const decoded: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value.mapValue.fields)) {
      decoded[key] = decodeValue(item);
    }
    return decoded;
  }
  return undefined;
}

function documentId(name: string) {
  return name.split("/").pop() ?? name;
}

function restConfig() {
  const projectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "").trim();
  const apiKey = (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "").trim();
  return { projectId, apiKey };
}

function restHeaders() {
  const appUrl = getAppUrl();
  return {
    Origin: appUrl,
    Referer: `${appUrl}/`,
  };
}

export async function listPlansFromFirestoreRest(): Promise<PricingPlan[]> {
  const { projectId, apiKey } = restConfig();
  if (!projectId || !apiKey) return [];
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/about/pricing/plans?key=${encodeURIComponent(apiKey)}`,
    { cache: "no-store", headers: restHeaders() },
  );
  if (!response.ok) return [];
  const payload = (await response.json()) as { documents?: Array<{ name: string; fields?: Record<string, RestValue> }> };
  const plans = (payload.documents ?? []).map((doc) => {
    const data = decodeValue({ mapValue: { fields: doc.fields ?? {} } }) as Record<string, unknown>;
    return mapPricingPlan(documentId(doc.name), data);
  });
  return sortPricingPlans(plans.filter((plan) => plan.active));
}

export async function getPlanFromFirestoreRest(planId: string): Promise<PricingPlan | null> {
  const { projectId, apiKey } = restConfig();
  if (!projectId || !apiKey || !planId) return null;
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/about/pricing/plans/${encodeURIComponent(planId)}?key=${encodeURIComponent(apiKey)}`,
    { cache: "no-store", headers: restHeaders() },
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as { name?: string; fields?: Record<string, RestValue> };
  if (!payload.fields) return null;
  const data = decodeValue({ mapValue: { fields: payload.fields } }) as Record<string, unknown>;
  return mapPricingPlan(documentId(payload.name ?? planId), data);
}
