import { createHmac, timingSafeEqual } from "crypto";
import { readEnv } from "@/lib/env.server";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { handleRouteError, json } from "@/lib/http";
import { logger } from "@/lib/logger";
import { redeployProject } from "@/lib/projects/service";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

function verifySignature(raw: string, signature: string | null) {
  const secret = readEnv("GITHUB_WEBHOOK_SECRET") || readEnv("CRON_SECRET");
  if (!secret || !signature) {
    throw new AppError("FORBIDDEN", "Invalid GitHub webhook signature.", 401);
  }
  const digest = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  const left = Buffer.from(digest);
  const right = Buffer.from(signature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new AppError("FORBIDDEN", "Invalid GitHub webhook signature.", 401);
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    verifySignature(raw, request.headers.get("x-hub-signature-256"));
    const event = request.headers.get("x-github-event");
    if (event === "ping") return json({ ok: true });
    if (event !== "push") return json({ ok: true, ignored: true });
    const payload = JSON.parse(raw) as {
      ref?: string;
      repository?: { full_name?: string; id?: number };
    };
    const repo = payload.repository?.full_name;
    const branch = payload.ref?.replace("refs/heads/", "");
    if (!repo || !branch) return json({ ok: true });

    const db = getAdminDb();
    const projects = await db
      .collectionGroup(collections.projects)
      .where("repository", "==", repo)
      .where("autoDeploy", "==", true)
      .where("branch", "==", branch)
      .get();

    const results = [];
    for (const doc of projects.docs) {
      const data = doc.data();
      try {
        await redeployProject(String(data.userId), String(data.projectId));
        results.push({ projectId: data.projectId, ok: true });
      } catch (error) {
        logger.warn("Auto-deploy skipped", {
          projectId: data.projectId,
          message: error instanceof Error ? error.message : "unknown",
        });
        results.push({ projectId: data.projectId, ok: false });
      }
    }
    return json({ ok: true, results });
  } catch (error) {
    return handleRouteError(error, "github.webhook");
  }
}
