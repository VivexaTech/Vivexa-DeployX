import { z } from "zod";
import { createSessionCookie } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { handleRouteError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ idToken?: string }>(request);
    const { idToken } = z.object({ idToken: z.string().min(20) }).parse(body);
    const decoded = await createSessionCookie(idToken);
    await enforceRateLimit(decoded.uid, "auth").catch(() => undefined);
    return json({ ok: true, uid: decoded.uid });
  } catch (error) {
    return handleRouteError(error, "auth.session");
  }
}
