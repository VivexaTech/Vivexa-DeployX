import { z } from "zod";
import { verifyRequestUser } from "@/lib/auth/session";
import { handleRouteError, json, readJson } from "@/lib/http";
import { updateProjectEnv } from "@/lib/projects/service";
import { envVarSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await verifyRequestUser(request);
    const { projectId } = await context.params;
    const body = z.object({ envVars: z.array(envVarSchema).max(50) }).parse(await readJson(request));
    await updateProjectEnv(user.uid, projectId, body.envVars);
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "projects.env");
  }
}
