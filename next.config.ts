import type { NextConfig } from "next";
import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";

if (process.env.NODE_ENV === "development") {
  setupDevPlatform({
    configPath: "wrangler.local.toml",
    persist: true
  });
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
