import { verifyRequestUser } from "@/lib/auth/session";
import { getGithubAuthorizeUrl, githubOAuthLogMeta } from "@/lib/github/oauth";
import { handleRouteError, json } from "@/lib/http";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    await enforceRateLimit(user.uid, "github");
    const { url, redirectUri } = getGithubAuthorizeUrl(user.uid, request);
    logger.info("github.oauth.redirect", githubOAuthLogMeta(request, redirectUri));
    return json({ url });
  } catch (error) {
    return handleRouteError(error, "github.connect");
  }
}
