import { applySessionCookie, createSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { handleRouteError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    logger.info("auth.session reached", {
      method: request.method,
      hasAuthHeader: Boolean(request.headers.get("authorization")),
      contentType: request.headers.get("content-type") ?? "none",
    });
    const body = await readJson<{ idToken?: string }>(request);
    const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";
    logger.info("auth.session token", {
      hasCredential: idToken.length > 0,
      credentialChars: idToken.length,
    });
    if (idToken.length < 20) {
      throw new AppError("VALIDATION", "A valid Google sign-in token is required.", 400);
    }
    const { decoded, sessionCookie } = await createSession(idToken);
    logger.info("auth.session verified", {
      hasUid: Boolean(decoded.uid),
      hasEmail: Boolean(decoded.email),
      sessionChars: sessionCookie.length,
    });
    const response = json({ ok: true, uid: decoded.uid, email: decoded.email ?? null });
    return applySessionCookie(response, sessionCookie, request);
  } catch (error) {
    return handleRouteError(error, "auth.session");
  }
}
