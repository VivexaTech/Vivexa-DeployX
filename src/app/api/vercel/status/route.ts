import { NextResponse } from "next/server";
import { withUser } from "@/lib/security/api";
import { integrations } from "@/lib/env";
import { VERCEL_NOT_CONFIGURED } from "@/lib/vercel/client";

export const dynamic = "force-dynamic";

/** Tells the client whether real deployments are available. */
export const GET = withUser({}, async () => {
  const configured = integrations.vercel();
  return NextResponse.json({ configured, message: configured ? null : VERCEL_NOT_CONFIGURED });
});
