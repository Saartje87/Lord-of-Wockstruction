import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    // Vercel preview builds honour the dev options too (see `devOptionsOf`),
    // so the 3D World and `?stats` can be tried on a phone.
    WIABLO_PREVIEW: process.env.VERCEL_ENV === "preview" ? "true" : "false",
  },
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
