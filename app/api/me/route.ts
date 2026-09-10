import { upsertUserFromDecoded, verifyRequestUser } from "@/lib/auth/session";
import { getCurrentUsage, getUserPlan, getUserProfile, isSubscriptionEligible } from "@/lib/entitlements";
import { getGithubConnection } from "@/lib/github/client";
import { handleRouteError, json } from "@/lib/http";
import { listRecentDeployments, listUserProjects } from "@/lib/projects/service";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await verifyRequestUser(request);
    const user = await getUserProfile(session.uid).catch(async (error) => {
      if (error instanceof AppError && error.code === "NOT_FOUND") {
        return upsertUserFromDecoded(session);
      }
      throw error;
    });
    const [plan, usage, github, projects, deployments] = await Promise.all([
      getUserPlan(user),
      getCurrentUsage(session.uid),
      getGithubConnection(session.uid).catch(() => null),
      listUserProjects(session.uid).catch(() => []),
      listRecentDeployments(session.uid, 30).catch(() => []),
    ]);
    return json({
      user: { ...user, websiteCount: usage },
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
