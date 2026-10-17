import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Three.js ships untranspiled ESM.
  transpilePackages: ["three"],
  // This app is its own workspace root (don't infer one from lockfiles above it).
  turbopack: { root: process.cwd() },
  // The floating dev badge overlaps the console's own bottom navigation.
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The audio socket URL carries the visitor's key; never leak URLs.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
