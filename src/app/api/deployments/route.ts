import { NextResponse, after } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/security/api";
import { queueDeployment, runDeployment } from "@/lib/deployment/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicError } from "@/lib/utils/sanitize";
import type { Deployment } from "@/types/database";

export const maxDuration = 300;

const deploySchema = z.object({
  projectId: z.string().uuid(),
  deploymentId: z.string().uuid().optional(),
  commitSha: z.string().optional(),
  isRollback: z.boolean().optional(),
});

/** Starts a new production deployment (Deploy / Redeploy / Rollback). */
export const POST = withUser(
  { schema: deploySchema, rateLimit: { key: "deploy", limit: 15, windowMs: 60_000 } },
  async ({ user, body }) => {
    let commitSha = body.commitSha;
    let commitMessage: string | undefined;
    let commitAuthor: string | undefined;
    let branch: string | undefined;

    if (body.deploymentId) {
      const { data: prior } = await createAdminClient()
        .from("deployments")
        .select("*")
        .eq("id", body.deploymentId)
        .eq("project_id", body.projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!prior) throw new PublicError("Target deployment not found for rollback/redeploy.", 404);
      const priorDeployment = prior as Deployment;
      commitSha = priorDeployment.commit_sha ?? undefined;
      commitMessage = body.isRollback
        ? `Rollback to ${priorDeployment.commit_sha ? priorDeployment.commit_sha.slice(0, 7) : priorDeployment.id.slice(0, 7)}`
        : priorDeployment.commit_message ?? undefined;
      commitAuthor = priorDeployment.commit_author ?? undefined;
      branch = priorDeployment.branch ?? undefined;
    }

    const deployment = await queueDeployment(user.id, body.projectId, {
      branch,
      commitSha,
      commitMessage,
      commitAuthor,
      isRollback: body.isRollback,
    });

    after(() => runDeployment(deployment.id));

    // Return sanitized deployment
    const sanitized = {
      ...deployment,
      provider: "deployx",
      inspector_url: null,
    };

    return NextResponse.json({ deployment: sanitized }, { status: 202 });
  },
);
