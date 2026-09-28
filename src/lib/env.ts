import "server-only";

/**
 * Server-side view of which integrations are configured. Nothing in this
 * module ever returns a secret value — only booleans and public identifiers.
 */
function has(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

export const integrations = {
  supabase: () => has("NEXT_PUBLIC_SUPABASE_URL") && has("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseAdmin: () => integrations.supabase() && has("SUPABASE_SERVICE_ROLE_KEY"),
  github: () => has("GITHUB_CLIENT_ID") && has("GITHUB_CLIENT_SECRET"),
  vercel: () => has("VERCEL_TOKEN"),
  razorpay: () => has("RAZORPAY_KEY_ID") && has("RAZORPAY_KEY_SECRET"),
  razorpayWebhook: () => has("RAZORPAY_WEBHOOK_SECRET"),
  encryption: () => has("ENCRYPTION_KEY"),
};

export type IntegrationStatus = {
  supabase: boolean;
  github: boolean;
  vercel: boolean;
  razorpay: boolean;
  encryption: boolean;
};

export function getIntegrationStatus(): IntegrationStatus {
  return {
    supabase: integrations.supabaseAdmin(),
    github: integrations.github(),
    vercel: integrations.vercel(),
    razorpay: integrations.razorpay(),
    encryption: integrations.encryption(),
  };
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function optionalEnv(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

export const GITHUB_CALLBACK_PATH = "/api/github/callback";

/**
 * Returns a problem description when GITHUB_CALLBACK_URL doesn't point at the
 * GitHub connection handler. `/auth/callback` is the Supabase auth callback and
 * silently drops GitHub codes, so it is rejected explicitly.
 */
export function githubCallbackProblem(): string | null {
  const value = serverConfig.githubCallbackUrl();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `GITHUB_CALLBACK_URL is not a valid URL.`;
  }
  if (url.pathname.replace(/\/+$/, "") !== GITHUB_CALLBACK_PATH) {
    return `GITHUB_CALLBACK_URL must end with ${GITHUB_CALLBACK_PATH} (currently ${url.pathname}).`;
  }
  return null;
}

export const serverConfig = {
  vercelTeamId: () => optionalEnv("VERCEL_TEAM_ID"),
  vercelProjectPrefix: () => optionalEnv("VERCEL_PROJECT_PREFIX", "deployx"),
  subdomainBase: () => optionalEnv("DEPLOYX_SUBDOMAIN_BASE", "deployx.vivexatech.in"),
  githubCallbackUrl: () =>
    optionalEnv(
      "GITHUB_CALLBACK_URL",
      `${optionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")}${GITHUB_CALLBACK_PATH}`,
    ),
};
