import { z } from "zod";
import { verifyRequestUser } from "@/lib/auth/session";
import { handleRouteError, json, readJson } from "@/lib/http";
import { attachCustomDomain, attachPlatformSubdomain } from "@/lib/projects/service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { customDomainSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await verifyRequestUser(request);
    await enforceRateLimit(user.uid, "domain");
    const { projectId } = await context.params;
    const body = z
      .object({
        type: z.enum(["platform", "custom"]),
        subdomain: z.string().optional(),
        domain: z.string().optional(),
      })
      .parse(await readJson(request));
    if (body.type === "platform") {
      const result = await attachPlatformSubdomain(user.uid, projectId, body.subdomain ?? "");
      return json(result);
    }
    const parsed = customDomainSchema.parse({ domain: body.domain });
    const record = await attachCustomDomain(user.uid, projectId, parsed.domain);
    return json({ domain: record });
  } catch (error) {
    return handleRouteError(error, "projects.domains");
  }
}
