import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    runtime: "nodejs",
    vercel: process.env.VERCEL === "1",
  });
}
