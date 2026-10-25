import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      // Tiled's maps and tilesets, bundled as JSON.
      "*.tmj": { type: "json" },
      "*.tsj": { type: "json" },
    },
  },
};

export default nextConfig;
