import { z } from "zod";
import {
  BASIC_ABUSE_TERMS,
  PROJECT_NAME_MAX,
  PROJECT_NAME_MIN,
  SUBDOMAIN_MAX_LENGTH,
  SUBDOMAIN_MIN_LENGTH,
} from "@/config/constants";
import { slugify } from "@/lib/utils";

export const envVarSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[A-Z_][A-Z0-9_]*$/i, "Environment variable keys must be alphanumeric."),
  value: z.string().min(1).max(4000),
});

export const projectCreateSchema = z.object({
  name: z.string().min(PROJECT_NAME_MIN).max(PROJECT_NAME_MAX),
  repository: z.string().min(3).max(200),
  repositoryId: z.string().min(1).max(80),
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  branch: z.string().min(1).max(120),
  framework: z.string().max(60).optional().nullable(),
  envVars: z.array(envVarSchema).max(50).optional().default([]),
  platformSubdomain: z.string().max(SUBDOMAIN_MAX_LENGTH).optional().nullable(),
  autoDeploy: z.boolean().optional().default(false),
});

export const projectUpdateSchema = z.object({
  name: z.string().min(PROJECT_NAME_MIN).max(PROJECT_NAME_MAX).optional(),
  branch: z.string().min(1).max(120).optional(),
  envVars: z.array(envVarSchema).max(50).optional(),
  autoDeploy: z.boolean().optional(),
});

export const customDomainSchema = z.object({
  domain: z
    .string()
    .min(4)
    .max(253)
    .regex(/^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})+$/, "Enter a valid domain."),
});

export const subdomainSchema = z
  .string()
  .min(SUBDOMAIN_MIN_LENGTH)
  .max(SUBDOMAIN_MAX_LENGTH)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Use lowercase letters, numbers, and hyphens only.");

export const subscribeSchema = z.object({
  planId: z.string().min(1).max(80),
});

export const changePlanSchema = z.object({
  planId: z.string().min(1).max(80),
});

export const notificationUpdateSchema = z.object({
  read: z.boolean(),
});

export function normalizeSubdomain(value: string) {
  return slugify(value);
}

export function assertCleanSubdomain(value: string, reserved: string[]) {
  const parsed = subdomainSchema.parse(value);
  if (reserved.includes(parsed)) {
    throw new Error(`"${parsed}" is reserved and cannot be used.`);
  }
  if (BASIC_ABUSE_TERMS.some((term) => parsed.includes(term))) {
    throw new Error("This subdomain is not allowed.");
  }
  return parsed;
}

export const profileUpdateSchema = z.object({
  name: z.string().min(2).max(80),
});

export const adminSupportSchema = z.object({
  phone: z.string().min(5).max(40),
  email: z.string().email(),
});

export const adminCompanySchema = z.object({
  name: z.string().min(2).max(80),
  platformName: z.string().min(2).max(80),
  tagline: z.string().max(160).optional().default(""),
  mission: z.string().max(2000).optional().default(""),
  aboutPlatform: z.string().max(4000).optional().default(""),
  aboutCompany: z.string().max(4000).optional().default(""),
  whyExists: z.string().max(4000).optional().default(""),
});

export const adminPlanSchema = z.object({
  id: z.string().min(1).max(80).optional(),
  planName: z.string().min(2).max(60),
  planPrice: z.number().min(0),
  currency: z.string().min(3).max(8).optional().default("INR"),
  keyPoints: z.array(z.string().min(1).max(160)).max(20),
  maxWebsites: z.number().int().min(0).max(10000),
  duration: z.string().min(1).max(40),
  billingCycle: z.enum(["monthly", "yearly"]).optional().default("monthly"),
  razorpayPlanId: z.string().min(1).max(80),
  active: z.boolean().optional().default(true),
  displayOrder: z.number().int().min(0).max(1000).optional().default(0),
  gracePeriodDays: z.number().int().min(0).max(60).optional().default(3),
  features: z
    .object({
      customDomains: z.boolean().optional().default(false),
      githubDeployment: z.boolean().optional().default(true),
      environmentVariables: z.boolean().optional().default(true),
      automaticDeployments: z.boolean().optional().default(false),
      teamMembers: z.number().int().min(1).max(1000).optional().default(1),
      maxDeploymentsPerMonth: z.number().int().min(1).max(100000).nullable().optional(),
      supportLevel: z.string().max(40).optional().default("standard"),
    })
    .optional(),
});

export const adminShowcaseSchema = z.object({
  id: z.string().min(1).max(80).optional(),
  title: z.string().min(2).max(80),
  description: z.string().min(2).max(400),
  image: z.string().url(),
  projectUrl: z.string().url(),
  category: z.string().max(40).optional(),
  featured: z.boolean().optional().default(false),
});
