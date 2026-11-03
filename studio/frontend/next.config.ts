import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local-first app; routes read from a sibling FastAPI process at runtime.
  // Disable static prerendering so client-hook pages don't fail the build.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
