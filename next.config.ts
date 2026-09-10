import type { NextConfig } from "next";

const firebaseAdminTrace = [
  "./node_modules/firebase-admin/**/*",
  "./node_modules/@google-cloud/**/*",
  "./node_modules/google-gax/**/*",
  "./node_modules/google-auth-library/**/*",
  "./node_modules/jsonwebtoken/**/*",
  "./node_modules/jwks-rsa/**/*",
  "./node_modules/node-forge/**/*",
  "./node_modules/@grpc/**/*",
  "./node_modules/protobufjs/**/*",
];

const tracedApiRoutes = [
  "/api/auth/session",
  "/api/auth/logout",
  "/api/me",
  "/api/public/content",
  "/api/profile",
  "/api/notifications",
  "/api/notifications/read-all",
  "/api/projects",
  "/api/github/connect",
  "/api/github/repos",
  "/api/github/callback",
  "/api/github/disconnect",
  "/api/github/webhook",
  "/api/billing/subscribe",
  "/api/billing/cancel",
  "/api/billing/change-plan",
  "/api/billing/sync",
  "/api/invoices",
  "/api/admin/content",
  "/api/webhooks/razorpay",
  "/api/cron/renewal-reminders",
  "/api/cron/subscription-reconcile",
  "/api/cron/domain-verify",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  outputFileTracingIncludes: {
    "/*": firebaseAdminTrace,
    "/api/**": firebaseAdminTrace,
    "/api/**/*": firebaseAdminTrace,
    ...Object.fromEntries(tracedApiRoutes.map((route) => [route, firebaseAdminTrace])),
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    const authHeaders = [
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
      { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
    ];
    return [
      { source: "/", headers: authHeaders },
      { source: "/:path*", headers: authHeaders },
    ];
  },
};

export default nextConfig;
