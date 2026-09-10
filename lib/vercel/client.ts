import { readEnv, requireServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const VERCEL_API = "https://api.vercel.com";

export function vercelConfigured() {
  return Boolean(readEnv("VERCEL_TOKEN"));
}

function teamQuery() {
  const teamId = readEnv("VERCEL_TEAM_ID");
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

function withTeam(path: string) {
  const query = teamQuery();
  if (!query) return path;
  return path.includes("?") ? `${path}&teamId=${readEnv("VERCEL_TEAM_ID")}` : `${path}${query}`;
}

export async function vercelFetch<T>(path: string, init?: RequestInit): Promise<T> {
  requireServerEnv(["VERCEL_TOKEN"]);
  const response = await fetch(`${VERCEL_API}${withTeam(path)}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${readEnv("VERCEL_TOKEN")}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: { message: text } };
  }
  if (!response.ok) {
    const message =
      (body as { error?: { message?: string } })?.error?.message ||
      `Vercel request failed (${response.status}).`;
    logger.warn("Vercel API error", { path, status: response.status, message });
    throw new AppError("VERCEL_ERROR", message, response.status === 429 ? 429 : 502);
  }
  return body as T;
}
