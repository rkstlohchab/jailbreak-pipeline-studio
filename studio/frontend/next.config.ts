import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the generated collection with the read-only hosted API function.
  outputFileTracingIncludes: { "/api/*": ["./.collection/index.json"] },
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
