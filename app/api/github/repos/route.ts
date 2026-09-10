import { verifyRequestUser } from "@/lib/auth/session";
import { listGithubBranches, listGithubRepos } from "@/lib/github/client";
import { handleRouteError, json } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    await enforceRateLimit(user.uid, "github");
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    if (owner && repo) {
      const branches = await listGithubBranches(user.uid, owner, repo);
      return json({ branches });
    }
    const repos = await listGithubRepos(user.uid);
    return json({ repos });
  } catch (error) {
    return handleRouteError(error, "github.repos");
  }
}
