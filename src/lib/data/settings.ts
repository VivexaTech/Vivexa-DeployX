import "server-only";
import { cache } from "react";
import { integrations } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteConfig } from "@/lib/site";

export type PlatformSettings = {
  platform_name: string;
  logo_url: string;
  support_email: string;
  pricing_visible: boolean;
  maintenance_mode: boolean;
  signup_enabled: boolean;
  default_plan_slug: string;
  deployments_enabled: boolean;
  max_upload_files: number;
  legal_terms: string;
  legal_privacy: string;
  legal_acceptable_use: string;
  legal_refund: string;
  legal_infrastructure: string;
  gst_rate: number;
  tax_home_state: string;
  other_tax_name: string;
  other_tax_rate: number;
  invoice_prefix: string;
  invoice_footer: string;
  invoice_tax_note: string;
  company_name: string;
  company_logo_url: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_gstin: string;
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  platform_name: siteConfig.name,
  logo_url: "",
  support_email: siteConfig.supportEmail,
  pricing_visible: true,
  maintenance_mode: false,
  signup_enabled: true,
  default_plan_slug: "free",
  deployments_enabled: true,
  max_upload_files: 5000,
  legal_terms: "",
  legal_privacy: "",
  legal_acceptable_use: "",
  legal_refund: "",
  legal_infrastructure: "",
  gst_rate: 18,
  tax_home_state: "HR",
  other_tax_name: "Platform Tax",
  other_tax_rate: 4,
  invoice_prefix: "VDX",
  invoice_footer: "",
  invoice_tax_note: "",
  company_name: "",
  company_logo_url: "",
  company_address: "",
  company_phone: "",
  company_email: "",
  company_gstin: "",
};

export const GENERAL_SETTING_KEYS = [
  "platform_name",
  "logo_url",
  "support_email",
  "pricing_visible",
  "maintenance_mode",
  "signup_enabled",
  "default_plan_slug",
  "deployments_enabled",
  "max_upload_files",
  "legal_terms",
  "legal_privacy",
  "legal_acceptable_use",
  "legal_refund",
  "legal_infrastructure",
] as const satisfies readonly (keyof PlatformSettings)[];

export const TAX_SETTING_KEYS = ["gst_rate", "tax_home_state", "other_tax_name", "other_tax_rate"] as const satisfies readonly (keyof PlatformSettings)[];

export const INVOICE_SETTING_KEYS = [
  "company_name",
  "company_logo_url",
  "company_address",
  "company_phone",
  "company_email",
  "company_gstin",
  "invoice_prefix",
  "invoice_footer",
  "invoice_tax_note",
] as const satisfies readonly (keyof PlatformSettings)[];

export const PUBLIC_SETTING_KEYS: (keyof PlatformSettings)[] = [
  "platform_name",
  "logo_url",
  "support_email",
  "pricing_visible",
  "maintenance_mode",
  "signup_enabled",
  "deployments_enabled",
  "legal_terms",
  "legal_privacy",
  "legal_acceptable_use",
  "legal_refund",
  "legal_infrastructure",
];

/** Loads platform settings merged over defaults. Safe to call without Supabase. */
export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  if (!integrations.supabaseAdmin()) return DEFAULT_SETTINGS;
  try {
    const { data, error } = await createAdminClient().from("platform_settings").select("key, value");
    if (error || !data) return DEFAULT_SETTINGS;
    const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const row of data as { key: string; value: unknown }[]) {
      if (row.key in DEFAULT_SETTINGS) {
        const expected = typeof DEFAULT_SETTINGS[row.key as keyof PlatformSettings];
        if (typeof row.value === expected) merged[row.key] = row.value;
      }
    }
    return merged as PlatformSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
});
