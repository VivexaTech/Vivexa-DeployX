import { NextResponse } from "next/server";
import { withUser } from "@/lib/security/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncDeployment } from "@/lib/deployment/service";
import { toPublicVercelError } from "@/lib/vercel/client";
import { PublicError } from "@/lib/utils/sanitize";
import type { Deployment } from "@/types/database";

export const dynamic = "force-dynamic";

function sanitizeDeployment(d: Deployment): Deployment {
  return {
    ...d,
    provider: "deployx",
    inspector_url: null,
  };
}

/** Returns the deployment, syncing its status from the provider when in progress. */
export const GET = withUser({ rateLimit: { key: "deploy-status", limit: 120, windowMs: 60_000 } }, async ({ user, params }) => {
  const { data } = await createAdminClient()
    .from("deployments")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) throw new PublicError("Deployment not found", 404);

  try {
    const deployment = await syncDeployment(data as Deployment);
    const { data: project } = await createAdminClient()
      .from("projects")
      .select("production_url")
      .eq("id", deployment.project_id)
      .maybeSingle();
    const productionUrl = (project as { production_url: string | null } | null)?.production_url ?? deployment.url;
    return NextResponse.json({ deployment: sanitizeDeployment(deployment), productionUrl });
  } catch (error) {
    const publicError = toPublicVercelError(error, "Could not refresh deployment status");
    return NextResponse.json({ deployment: sanitizeDeployment(data as Deployment), warning: publicError.message });
  }
});
