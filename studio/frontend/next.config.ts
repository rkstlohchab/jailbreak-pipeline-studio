import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Keep the generated collection with the read-only hosted API function.
  outputFileTracingIncludes: { "/api/*": ["./.collection/index.json"] },
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    // The frontend and its shared knowledge records both live under studio/.
    root: path.resolve(__dirname, ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
