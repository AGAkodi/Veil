import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: without this Turbopack walks up and picks up an
  // unrelated pnpm-lock.yaml in the home directory.
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["@provablehq/sdk", "@provablehq/wasm"],
};

export default nextConfig;
