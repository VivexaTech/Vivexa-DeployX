import { verifyRequestUser } from "@/lib/auth/session";
import { handleRouteError, json } from "@/lib/http";
import { refreshDomain, removeDomain } from "@/lib/projects/service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; domainId: string }> },
) {
  try {
    const user = await verifyRequestUser(request);
    const { projectId, domainId } = await context.params;
    const domain = await refreshDomain(user.uid, projectId, domainId);
    return json({ domain });
  } catch (error) {
    return handleRouteError(error, "projects.domain.refresh");
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string; domainId: string }> },
) {
  try {
    const user = await verifyRequestUser(request);
    const { projectId, domainId } = await context.params;
    await removeDomain(user.uid, projectId, domainId);
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "projects.domain.remove");
  }
}
