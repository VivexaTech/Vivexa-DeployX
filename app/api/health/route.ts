import { NextResponse } from "next/server";
import {
  getAppUrl,
  getFirebaseAdminClientEmail,
  getFirebaseAdminProjectId,
  getRequestOrigin,
  isAdminSdkConfigured,
  readEnv,
} from "@/lib/env.server";
import { probeAdminSdk } from "@/lib/firebase/admin";
import { GITHUB_CALLBACK_PATH } from "@/lib/github/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = isAdminSdkConfigured() ? probeAdminSdk() : { ready: false as const, code: "CONFIG_MISSING" };
  const requestOrigin = getRequestOrigin(request);
  return NextResponse.json({
    ok: true,
    runtime: "nodejs",
    vercel: process.env.VERCEL === "1",
    node: process.versions.node,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    firebase: {
      publicApiKey: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim()),
      publicProjectId: Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()),
      adminProjectId: Boolean(getFirebaseAdminProjectId()),
      adminClientEmail: Boolean(getFirebaseAdminClientEmail()),
      adminConfigured: isAdminSdkConfigured(),
      adminReady: admin.ready,
      adminCode: admin.ready ? undefined : "code" in admin ? admin.code : undefined,
    },
    billing: {
      razorpayKeys: Boolean(readEnv("RAZORPAY_KEY_ID") && readEnv("RAZORPAY_KEY_SECRET")),
      razorpayWebhookSecret: Boolean(readEnv("RAZORPAY_WEBHOOK_SECRET")),
      resend: Boolean(readEnv("RESEND_API_KEY") && readEnv("RESEND_FROM_EMAIL")),
    },
    github: {
      configured: Boolean(readEnv("GITHUB_CLIENT_ID") && readEnv("GITHUB_CLIENT_SECRET")),
      callbackRoute: GITHUB_CALLBACK_PATH,
      appUrl: getAppUrl(),
      requestOrigin,
      redirectUri: `${requestOrigin}${GITHUB_CALLBACK_PATH}`,
    },
  });
}
