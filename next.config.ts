import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Three.js needs this for proper bundling
  transpilePackages: ["three"],
};

export default nextConfig;
