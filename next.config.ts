import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/firebase-admin/**/*",
      "./node_modules/@google-cloud/**/*",
      "./node_modules/google-gax/**/*",
      "./node_modules/google-auth-library/**/*",
      "./node_modules/jsonwebtoken/**/*",
      "./node_modules/jwks-rsa/**/*",
      "./node_modules/node-forge/**/*",
    ],
    "/*": [
      "./node_modules/firebase-admin/**/*",
      "./node_modules/@google-cloud/**/*",
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
