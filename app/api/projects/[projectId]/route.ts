import { verifyRequestUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getAdminDb } from "@/lib/firebase/admin";
import { userDeploymentsPath, userDomainsPath, userProjectPath } from "@/lib/firebase/collections";
import { handleRouteError, json, readJson } from "@/lib/http";
import { deleteUserProject } from "@/lib/projects/service";
import { nowIso } from "@/lib/utils";
import { projectUpdateSchema } from "@/lib/validation";
import type { Deployment, Project, ProjectDomain } from "@/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await verifyRequestUser(request);
    const { projectId } = await context.params;
    const db = getAdminDb();
    const snap = await db.doc(userProjectPath(user.uid, projectId)).get();
    if (!snap.exists) throw new AppError("NOT_FOUND", "Project not found.", 404);
    const [deployments, domains] = await Promise.all([
      db.collection(userDeploymentsPath(user.uid, projectId)).orderBy("createdAt", "desc").get(),
      db.collection(userDomainsPath(user.uid, projectId)).get(),
    ]);
    return json({
      project: snap.data() as Project,
      deployments: deployments.docs.map((doc) => doc.data() as Deployment),
      domains: domains.docs.map((doc) => doc.data() as ProjectDomain),
    });
  } catch (error) {
    return handleRouteError(error, "projects.get");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await verifyRequestUser(request);
    const { projectId } = await context.params;
    const body = projectUpdateSchema.parse(await readJson(request));
    const db = getAdminDb();
    const ref = db.doc(userProjectPath(user.uid, projectId));
    const snap = await ref.get();
    if (!snap.exists) throw new AppError("NOT_FOUND", "Project not found.", 404);
    await ref.set({ ...body, updatedAt: nowIso() }, { merge: true });
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "projects.update");
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await verifyRequestUser(request);
    const { projectId } = await context.params;
    await deleteUserProject(user.uid, projectId);
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "projects.delete");
  }
}
