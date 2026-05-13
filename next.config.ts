import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: do NOT use output: "export" — it bakes the build-time date into the
  // static HTML so every visitor sees yesterday's puzzle until the next deploy.
  async headers() {
    return [
      {
        // Disable CDN/browser caching of the HTML shell so a stale deploy can
        // never get pinned for days (the JS/CSS chunks are still cached
        // aggressively by their content-hashed filenames).
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
