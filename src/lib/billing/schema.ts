import { z } from "zod";
import { isValidGstin, normalizeGstin, normalizeStateCode } from "@/lib/billing/tax";

/** Shared by the checkout form (inline messages) and the server (authoritative validation). */
export const billingDetailsSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  company_name: z.string().trim().max(120).optional().transform((v) => v || null),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()-]/g, ""))
    .refine((v) => /^\+?[0-9]{8,15}$/.test(v), "Enter a valid phone number"),
  address: z.string().trim().min(5, "Enter your street address").max(300),
  city: z.string().trim().min(2, "Enter your city").max(80),
  state: z
    .string()
    .trim()
    .min(1, "Select your state")
    .transform((v, ctx) => {
      const code = normalizeStateCode(v);
      if (!code) {
        ctx.addIssue({ code: "custom", message: "Select a valid state or union territory" });
        return z.NEVER;
      }
      return code;
    }),
  postal_code: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code"),
  country: z.literal("IN", { message: "Billing is currently available for Indian addresses only" }).default("IN"),
});

export const gstDetailsSchema = z
  .object({
    enabled: z.boolean().default(false),
    gstin: z.string().trim().max(20).optional().default(""),
    legal_name: z.string().trim().max(160).optional().default(""),
    address: z.string().trim().max(400).optional().default(""),
  })
  .superRefine((gst, ctx) => {
    if (!gst.enabled) return;
    if (!isValidGstin(gst.gstin)) ctx.addIssue({ code: "custom", path: ["gstin"], message: "Enter a valid 15-character GSTIN" });
    if (gst.legal_name.length < 2) ctx.addIssue({ code: "custom", path: ["legal_name"], message: "Enter the registered business name" });
  })
  .transform((gst) =>
    gst.enabled
      ? { enabled: true as const, gstin: normalizeGstin(gst.gstin), legal_name: gst.legal_name, address: gst.address || null }
      : { enabled: false as const, gstin: null, legal_name: null, address: null },
  );

export type BillingDetailsInput = z.input<typeof billingDetailsSchema>;
export type BillingDetails = z.output<typeof billingDetailsSchema>;
export type GstDetailsInput = z.input<typeof gstDetailsSchema>;
export type GstDetails = z.output<typeof gstDetailsSchema>;
