import { clearSessionFromResponse } from "@/lib/auth/session";
import { handleRouteError, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return clearSessionFromResponse(json({ ok: true }), request);
  } catch (error) {
    return handleRouteError(error, "auth.logout");
  }
}
