import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
