import { applySessionCookie, createSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { handleRouteError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ idToken?: string }>(request);
    const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";
    if (idToken.length < 20) {
      throw new AppError("VALIDATION", "A valid Google sign-in token is required.", 400);
    }
    const { decoded, sessionCookie } = await createSession(idToken);
    await enforceRateLimit(decoded.uid, "auth").catch(() => undefined);
    const response = json({ ok: true, uid: decoded.uid, email: decoded.email ?? null });
    return applySessionCookie(response, sessionCookie, request);
  } catch (error) {
    return handleRouteError(error, "auth.session");
  }
}
