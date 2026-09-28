import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { integrations } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncDeployment } from "@/lib/deployment/service";
import { safeCompare } from "@/lib/utils/crypto";
import type { Deployment } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * Optional Vercel webhook (deployment.* events). When configured, it speeds up
 * status updates; without it the dashboard polls the provider API instead.
 */
export async function POST(request: Request) {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  if (!secret || !integrations.supabaseAdmin()) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("x-vercel-signature") ?? "";
  const expected = createHmac("sha1", secret).update(raw).digest("hex");
  if (!signature || !safeCompare(expected, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: { type?: string; payload?: { deployment?: { id?: string } } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const providerId = body.payload?.deployment?.id;
  if (!body.type?.startsWith("deployment.") || !providerId) return NextResponse.json({ ok: true });

  const { data } = await createAdminClient().from("deployments").select("*").eq("provider_deployment_id", providerId).maybeSingle();
  if (data) {
    try {
      await syncDeployment(data as Deployment);
    } catch (error) {
      console.error("[vercel webhook] sync failed", error);
    }
  }
  return NextResponse.json({ ok: true });
}
