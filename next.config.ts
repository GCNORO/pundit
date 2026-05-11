import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: do NOT use output: "export" — it bakes the build-time date into the
  // static HTML so every visitor sees yesterday's puzzle until the next deploy.
};

export default nextConfig;
