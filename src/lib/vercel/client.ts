import "server-only";
import { integrations, serverConfig } from "@/lib/env";
import { PublicError } from "@/lib/utils/sanitize";

const VERCEL_API = "https://api.vercel.com";

export const VERCEL_NOT_CONFIGURED =
  "Deployment infrastructure is not configured. Configure deployment credentials to enable real deployments.";

export function assertVercelConfigured(): void {
  if (!integrations.vercel()) throw new PublicError(VERCEL_NOT_CONFIGURED, 503);
}

export class VercelApiError extends Error {
  status: number;
  code: string | undefined;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "VercelApiError";
    this.status = status;
    this.code = code;
  }
}

function withTeam(path: string): string {
  const teamId = serverConfig.vercelTeamId();
  if (!teamId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(teamId)}`;
}

/** Authenticated request to the Vercel REST API. Token never leaves the server. */
export async function vercelFetch<T>(path: string, init: RequestInit & { rawBody?: Buffer } = {}): Promise<T> {
  assertVercelConfigured();
  const { rawBody, ...rest } = init;
  const response = await fetch(`${VERCEL_API}${withTeam(path)}`, {
    ...rest,
    body: rawBody ? new Uint8Array(rawBody) : rest.body,
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      ...(rawBody ? {} : { "Content-Type": "application/json" }),
      ...rest.headers,
    },
    cache: "no-store",
  });

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const err = (data as { error?: { message?: string; code?: string } } | undefined)?.error;
    throw new VercelApiError(err?.message ?? `Vercel API error (${response.status})`, response.status, err?.code);
  }
  return data as T;
}

/** Converts provider errors into messages that are safe to show users. */
export function toPublicVercelError(error: unknown, fallback: string): PublicError {
  if (error instanceof PublicError) return error;
  if (error instanceof VercelApiError) {
    if (error.status === 401 || error.status === 403) {
      return new PublicError("The deployment infrastructure rejected the request. Please verify platform credentials.", 502);
    }
    if (error.status === 429) return new PublicError("The deployment infrastructure is rate limiting requests. Try again shortly.", 429);
    const sanitizedMsg = error.message.replace(/vercel/gi, "DeployX");
    return new PublicError(`${fallback}: ${sanitizedMsg}`, 502);
  }
  return new PublicError(fallback, 502);
}
