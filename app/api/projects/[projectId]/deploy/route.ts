import { verifyRequestUser } from "@/lib/auth/session";
import { handleRouteError, json } from "@/lib/http";
import { redeployProject, syncDeploymentStatus } from "@/lib/projects/service";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await verifyRequestUser(request);
    await enforceRateLimit(user.uid, "deploy");
    const { projectId } = await context.params;
    const deployment = await redeployProject(user.uid, projectId);
    return json({ deployment });
  } catch (error) {
    return handleRouteError(error, "projects.redeploy");
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await verifyRequestUser(request);
    const { projectId } = await context.params;
    const deploymentId = new URL(request.url).searchParams.get("deploymentId");
    if (!deploymentId) {
      return json({ error: "deploymentId is required" }, 400);
    }
    const deployment = await syncDeploymentStatus(user.uid, projectId, deploymentId);
    return json({ deployment });
  } catch (error) {
    return handleRouteError(error, "projects.sync");
  }
}
