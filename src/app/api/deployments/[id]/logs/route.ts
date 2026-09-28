import { NextResponse } from "next/server";
import { withUser } from "@/lib/security/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDeploymentLogs } from "@/lib/deployment/service";
import { PublicError } from "@/lib/utils/sanitize";
import type { Deployment } from "@/types/database";

export const dynamic = "force-dynamic";

export const GET = withUser({ rateLimit: { key: "deploy-logs", limit: 120, windowMs: 60_000 } }, async ({ user, params }) => {
  const { data } = await createAdminClient()
    .from("deployments")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) throw new PublicError("Deployment not found", 404);
  const deployment = data as Deployment;
  const logs = await getDeploymentLogs(deployment);
  return NextResponse.json({ logs, status: deployment.status });
});
