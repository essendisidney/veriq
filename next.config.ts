import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:dns", "node:tls"],
};

export default nextConfig;
