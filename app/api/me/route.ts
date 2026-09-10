import { verifyRequestUser } from "@/lib/auth/session";
import { getCurrentUsage, getUserPlan, getUserProfile, isSubscriptionEligible } from "@/lib/entitlements";
import { getGithubConnection } from "@/lib/github/client";
import { handleRouteError, json } from "@/lib/http";
import { listRecentDeployments, listUserProjects } from "@/lib/projects/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await verifyRequestUser(request);
    const user = await getUserProfile(session.uid);
    const [plan, usage, github, projects, deployments] = await Promise.all([
      getUserPlan(user),
      getCurrentUsage(session.uid),
      getGithubConnection(session.uid),
      listUserProjects(session.uid),
      listRecentDeployments(session.uid, 30),
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
