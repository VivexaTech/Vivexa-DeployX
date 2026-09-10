import { verifyRequestUser } from "@/lib/auth/session";
import { getGithubAuthorizeUrl } from "@/lib/github/oauth";
import { handleRouteError, json } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    await enforceRateLimit(user.uid, "github");
    return json({ url: getGithubAuthorizeUrl(user.uid) });
  } catch (error) {
    return handleRouteError(error, "github.connect");
  }
}
