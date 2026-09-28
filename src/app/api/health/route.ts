import { NextResponse } from "next/server";
import { getIntegrationStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Liveness probe with integration configuration flags (no secrets). */
export function GET() {
  return NextResponse.json({ ok: true, integrations: getIntegrationStatus() });
}
