import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // This project sits inside a multi-project workspace that has its own
    // package-lock.json above it. Without pinning the root, Turbopack walks up,
    // finds the outer lockfile, and warns on every build.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
