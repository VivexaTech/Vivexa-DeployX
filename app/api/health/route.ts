import { NextResponse } from "next/server";
import {
  getFirebaseAdminClientEmail,
  getFirebaseAdminProjectId,
  isAdminSdkConfigured,
} from "@/lib/env.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const publicProjectId = Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim());
  const adminProjectId = Boolean(getFirebaseAdminProjectId());
  return NextResponse.json({
    ok: true,
    runtime: "nodejs",
    vercel: process.env.VERCEL === "1",
    node: process.versions.node,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    firebase: {
      publicApiKey: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim()),
      publicProjectId,
      adminProjectId,
      adminClientEmail: Boolean(getFirebaseAdminClientEmail()),
      adminConfigured: isAdminSdkConfigured(),
    },
  });
}
