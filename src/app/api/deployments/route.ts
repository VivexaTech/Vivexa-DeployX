import { NextResponse, after } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/security/api";
import { queueDeployment, runDeployment } from "@/lib/deployment/service";

export const maxDuration = 300;

/** Starts a new production deployment (Deploy / Redeploy). */
export const POST = withUser(
  { schema: z.object({ projectId: z.string().uuid() }), rateLimit: { key: "deploy", limit: 10, windowMs: 60_000 } },
  async ({ user, body }) => {
    const deployment = await queueDeployment(user.id, body.projectId);
    after(() => runDeployment(deployment.id));
    return NextResponse.json({ deployment }, { status: 202 });
  },
);
