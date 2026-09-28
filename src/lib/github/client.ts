import "server-only";
import { integrations, requireEnv, serverConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/utils/crypto";
import { PublicError } from "@/lib/utils/sanitize";

const GITHUB_API = "https://api.github.com";

export const GITHUB_NOT_CONFIGURED =
  "GitHub integration is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable repository imports.";

export function assertGithubConfigured(): void {
  if (!integrations.github()) throw new PublicError(GITHUB_NOT_CONFIGURED, 503);
}

type LogFields = Record<string, string | number | boolean | null | undefined>;

/** Structured GitHub integration log. Callers must never pass tokens or secrets. */
export function logGithub(level: "info" | "warn" | "error", event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ scope: "github", event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GITHUB_CLIENT_ID"),
    redirect_uri: serverConfig.githubCallbackUrl(),
    scope: "repo read:user",
    state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<{ accessToken: string; scope: string }> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("GITHUB_CLIENT_ID"),
      client_secret: requireEnv("GITHUB_CLIENT_SECRET"),
      code,
      redirect_uri: serverConfig.githubCallbackUrl(),
    }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as { access_token?: string; scope?: string; error?: string };
  if (!response.ok || !data.access_token) {
    // GitHub's error codes (e.g. bad_verification_code, redirect_uri_mismatch) contain no secrets.
    logGithub("error", "token_exchange_failed", { status: response.status, githubError: data.error ?? null });
    throw new PublicError("GitHub authorization failed. Please try connecting again.", 400);
  }
  return { accessToken: data.access_token, scope: data.scope ?? "" };
}

export async function githubFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Vivexa-DeployX",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (response.status === 401) {
    logGithub("warn", "api_unauthorized", { path: path.split("?")[0] });
    throw new PublicError("Your GitHub authorization has expired or was revoked. Disconnect and reconnect GitHub.", 401);
  }
  if (response.status === 403) {
    const rateLimited = response.headers.get("x-ratelimit-remaining") === "0";
    logGithub("warn", "api_forbidden", { path: path.split("?")[0], rateLimited });
    throw new PublicError(
      rateLimited
        ? "GitHub API rate limit reached. Please wait a few minutes and try again."
        : "GitHub denied access. The organization may restrict OAuth apps, or the granted permissions are insufficient.",
      403,
    );
  }
  if (response.status === 404) throw new PublicError("Repository or resource not found on GitHub.", 404);
  if (!response.ok) {
    logGithub("error", "api_failed", { path: path.split("?")[0], status: response.status });
    throw new PublicError(`GitHub request failed (${response.status}).`, 502);
  }
  return (await response.json()) as T;
}

/** Loads and decrypts the stored GitHub token for a user (server only). */
export async function getUserGithubToken(userId: string): Promise<string> {
  assertGithubConfigured();
  if (!integrations.supabaseAdmin()) throw new PublicError("Database is not configured on this server.", 503);
  if (!integrations.encryption()) {
    throw new PublicError("ENCRYPTION_KEY is not configured, so stored GitHub tokens can't be read.", 503);
  }
  const { data, error } = await createAdminClient()
    .from("github_connections")
    .select("access_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    logGithub("error", "connection_lookup_failed", { userId, dbError: error.message });
    throw new PublicError("Could not load your GitHub connection. Please try again.", 500);
  }
  if (!data) throw new PublicError("Connect your GitHub account to continue.", 400);
  try {
    return decryptSecret((data as { access_token_encrypted: string }).access_token_encrypted);
  } catch {
    logGithub("error", "token_decrypt_failed", { userId });
    throw new PublicError("Your stored GitHub token can't be read (the encryption key may have changed). Disconnect and reconnect GitHub.", 409);
  }
}
