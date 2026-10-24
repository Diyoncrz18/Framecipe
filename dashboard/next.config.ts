import type { NextConfig } from "next";

// No cacheComponents/partialPrefetching: every page reads the filesystem per request (see `dynamic` in app/layout.tsx).
const nextConfig: NextConfig = {
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
