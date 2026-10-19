import { z } from "zod";
import { FRAMEWORKS } from "@/lib/frameworks";

const repoPart = z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/, "Invalid repository name");

const optionalCommand = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null));

export const rootDirectorySchema = z
  .string()
  .trim()
  .max(255)
  .regex(/^[A-Za-z0-9_./-]*$/, "Root directory contains invalid characters")
  .refine((v) => !v.includes(".."), "Root directory cannot contain '..'")
  .transform((v) => v.replace(/^\.?\/+|\/+$/g, ""));

export const envKeySchema = z
  .string()
  .trim()
  .min(1, "Key is required")
  .max(128)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Keys may contain letters, numbers and underscores, and cannot start with a number");

export const envVarInputSchema = z.object({
  key: envKeySchema,
  value: z.string().max(32_768, "Value is too long"),
  isSecret: z.boolean().default(true),
  targets: z.array(z.enum(["production", "preview", "development"])).min(1).default(["production", "preview"]),
});

export const projectSettingsSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(60),
  branch: z.string().trim().min(1).max(255),
  framework: z.enum(FRAMEWORKS.map((f) => f.id) as [string, ...string[]]),
  rootDirectory: rootDirectorySchema.default(""),
  buildCommand: optionalCommand,
  installCommand: optionalCommand,
  outputDirectory: optionalCommand,
  autoDeploy: z.boolean().optional(),
  webhookSecret: z.string().optional(),
});

export const createProjectSchema = projectSettingsSchema.extend({
  repoOwner: repoPart,
  repoName: repoPart,
  envVars: z.array(envVarInputSchema.pick({ key: true, value: true })).max(100).default([]),
  deploy: z.boolean().default(true),
});

const hostnameRegex = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/;

export const addDomainSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subdomain"),
    projectId: z.string().uuid(),
    name: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, "Subdomain may contain lowercase letters, numbers and hyphens"),
  }),
  z.object({
    type: z.literal("custom"),
    projectId: z.string().uuid(),
    name: z
      .string()
      .trim()
      .toLowerCase()
      .transform((v) => v.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
      .refine((v) => hostnameRegex.test(v), "Enter a valid domain, e.g. example.com or www.example.com"),
  }),
]);
