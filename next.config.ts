import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/firebase-admin/**/*",
      "./node_modules/@google-cloud/firestore/**/*",
      "./node_modules/@google-cloud/storage/**/*",
    ],
    "/*": [
      "./node_modules/firebase-admin/**/*",
      "./node_modules/@google-cloud/firestore/**/*",
    ],
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
