import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { getActiveUserForApi, type SessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { PublicError, publicErrorMessage } from "@/lib/utils/sanitize";
import { integrations } from "@/lib/env";

export function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * Rejects cross-site state-changing requests to JSON APIs. Browsers always send
 * Origin on POST/PUT/PATCH/DELETE fetches, so a mismatch indicates CSRF.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new PublicError("Cross-origin request rejected", 403);
  } catch (error) {
    if (error instanceof PublicError) throw error;
    throw new PublicError("Invalid origin", 403);
  }
}

type HandlerContext<T> = { user: SessionUser; body: T; request: Request; params: Record<string, string> };
type RouteContext = { params?: Promise<Record<string, string | string[]> | undefined> };

type Options<T> = {
  schema?: ZodType<T>;
  rateLimit?: { limit: number; windowMs: number; key: string };
};

/**
 * Wraps an authenticated JSON route handler with origin checks, rate limiting,
 * Zod validation and safe error responses.
 */
export function withUser<T = undefined>(
  options: Options<T>,
  handler: (ctx: HandlerContext<T>) => Promise<Response>,
) {
  return async (request: Request, context?: RouteContext): Promise<Response> => {
    try {
      // Routes without dynamic segments receive a context whose params resolve to undefined.
      const rawParams = (await context?.params) ?? {};
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawParams)) params[k] = Array.isArray(v) ? v.join("/") : v;

      if (!integrations.supabase()) {
        return jsonError("Supabase is not configured. Configure Supabase to enable this feature.", 503);
      }
      if (request.method !== "GET") assertSameOrigin(request);

      const user = await getActiveUserForApi();
      if (!user) return jsonError("Authentication required", 401);

      if (options.rateLimit) {
        const { ok, retryAfter } = rateLimit(
          `${options.rateLimit.key}:${user.id}:${clientIp(request.headers)}`,
          options.rateLimit.limit,
          options.rateLimit.windowMs,
        );
        if (!ok) return jsonError(`Too many requests. Try again in ${retryAfter}s.`, 429);
      }

      let body = undefined as T;
      if (options.schema) {
        const raw = request.method === "GET" ? Object.fromEntries(new URL(request.url).searchParams) : await request.json().catch(() => ({}));
        const parsed = options.schema.safeParse(raw);
        if (!parsed.success) {
          return jsonError(parsed.error.issues[0]?.message ?? "Invalid request", 422);
        }
        body = parsed.data;
      }

      return await handler({ user, body, request, params });
    } catch (error) {
      if (error instanceof PublicError) return jsonError(error.message, error.status);
      console.error("[api]", error);
      return jsonError(publicErrorMessage(error), 500);
    }
  };
}
