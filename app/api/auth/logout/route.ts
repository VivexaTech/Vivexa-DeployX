import { clearSessionCookie } from "@/lib/auth/session";
import { handleRouteError, json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearSessionCookie();
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "auth.logout");
  }
}
