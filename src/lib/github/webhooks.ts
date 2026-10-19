import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { githubFetch, logGithub } from "@/lib/github/client";
import { hmacSha256Hex, safeCompare } from "@/lib/utils/crypto";
import { siteConfig } from "@/lib/site";
import type { Project } from "@/types/database";

export interface GitHubWebhookConfig {
  url: string;
  content_type: string;
  secret?: string;
  insecure_ssl?: string;
}

export interface GitHubHook {
  id: number;
  name: string;
  active: boolean;
  events: string[];
  config: GitHubWebhookConfig;
}

/**
 * Returns the base webhook URL for GitHub push events.
 */
export function getWebhookUrl(projectId?: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || siteConfig.url).replace(/\/$/, "");
  const url = `${base}/api/webhooks/github`;
  if (projectId) return `${url}?projectId=${encodeURIComponent(projectId)}`;
  return url;
}

/**
 * Gets or computes a deterministic, secure webhook secret for a project.
 */
export function getProjectWebhookSecret(project: Pick<Project, "id" | "webhook_secret">): string {
  if (project.webhook_secret && project.webhook_secret.trim().length > 0) {
    return project.webhook_secret;
  }
  // Fallback to server env secret or derive deterministically from project ID + encryption key
  const serverKey = process.env.GITHUB_WEBHOOK_SECRET || process.env.ENCRYPTION_KEY || "deployx-git-webhook-secret";
  return hmacSha256Hex(serverKey, project.id);
}

/**
 * Generates a fresh random webhook secret.
 */
export function generateWebhookSecret(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Verifies a GitHub webhook signature (X-Hub-Signature-256).
 */
export function verifyGitHubSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return safeCompare(expected, signatureHeader);
}

/**
 * Attempts to automatically configure the GitHub webhook on the target repository.
 * If user lacks admin/hook permissions on GitHub, catches error gracefully.
 */
export async function setupRepoWebhook(
  token: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  secret: string,
): Promise<{ success: boolean; hookId?: number; error?: string }> {
  try {
    // 1. Check existing webhooks
    const hooks = await githubFetch<GitHubHook[]>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`);
    const cleanUrl = webhookUrl.split("?")[0];
    const existing = Array.isArray(hooks)
      ? hooks.find((h) => h.config?.url?.startsWith(cleanUrl) || h.config?.url?.includes("/api/webhooks/github"))
      : undefined;

    if (existing) {
      // Update existing webhook to ensure push event & secret are active
      try {
        const updated = await githubFetch<GitHubHook>(
          token,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${existing.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              active: true,
              events: ["push"],
              config: {
                url: webhookUrl,
                content_type: "json",
                secret,
                insecure_ssl: "0",
              },
            }),
          },
        );
        logGithub("info", "webhook_updated", { owner, repo, hookId: updated.id });
        return { success: true, hookId: updated.id };
      } catch {
        // If PATCH failed, existing webhook is still usable
        return { success: true, hookId: existing.id };
      }
    }

    // 2. Create new webhook
    const created = await githubFetch<GitHubHook>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`, {
      method: "POST",
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["push"],
        config: {
          url: webhookUrl,
          content_type: "json",
          secret,
          insecure_ssl: "0",
        },
      }),
    });
    logGithub("info", "webhook_created", { owner, repo, hookId: created.id });
    return { success: true, hookId: created.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logGithub("warn", "webhook_setup_failed", { owner, repo, error: message });
    return { success: false, error: message };
  }
}
