import { profileFromSession, verifyRequestUser } from "@/lib/auth/session";
import { upsertUserFromDecoded } from "@/lib/auth/user";
import { getCurrentUsage, getUserPlan, getUserProfile, isSubscriptionEligible } from "@/lib/entitlements";
import { getGithubConnection } from "@/lib/github/client";
import { handleRouteError, json } from "@/lib/http";
import { logger } from "@/lib/logger";
import { listRecentDeployments, listUserProjects } from "@/lib/projects/service";
import { isAppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await verifyRequestUser(request);
    logger.info("me authenticated", {
      hasUid: Boolean(session.uid),
      hasEmail: Boolean(session.email),
      usedBearer: Boolean(request.headers.get("authorization")?.startsWith("Bearer ")),
    });
    const user = await getUserProfile(session.uid).catch(async (error) => {
      try {
        if (!isAppError(error) || error.code === "NOT_FOUND" || error.code === "CONFIG_MISSING" || error.code === "FIREBASE_ERROR") {
          return await upsertUserFromDecoded(session);
        }
        throw error;
      } catch {
        return profileFromSession(session);
      }
    });
    const [plan, usage, github, projects, deployments] = await Promise.all([
      getUserPlan(user).catch(() => null),
      getCurrentUsage(session.uid).catch(() => 0),
      getGithubConnection(session.uid).catch(() => null),
      listUserProjects(session.uid).catch(() => []),
      listRecentDeployments(session.uid, 30).catch(() => []),
    ]);
    return json({
      user: {
        ...user,
        websiteCount: usage,
        websiteLimit: plan ? plan.maxWebsites : user.websiteLimit,
      },
      plan,
      github,
      projects,
      deployments,
      eligible: isSubscriptionEligible(user),
    });
  } catch (error) {
    return handleRouteError(error, "me");
  }
}
