import { verifyRequestUser } from "@/lib/auth/session";
import { handleRouteError, json, readJson } from "@/lib/http";
import { createAndDeployProject, listUserProjects } from "@/lib/projects/service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { projectCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    const projects = await listUserProjects(user.uid);
    return json({ projects });
  } catch (error) {
    return handleRouteError(error, "projects.list");
  }
}

export async function POST(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    await enforceRateLimit(user.uid, "deploy");
    const body = projectCreateSchema.parse(await readJson(request));
    const result = await createAndDeployProject(user.uid, body);
    return json(result, 201);
  } catch (error) {
    return handleRouteError(error, "projects.create");
  }
}
