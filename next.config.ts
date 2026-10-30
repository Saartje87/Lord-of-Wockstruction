import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    // Vercel preview builds honour `?stats` too (see `devOptionsOf`), so the
    // 60 fps rule can be checked on a phone.
    WOCKSTRUCTION_PREVIEW:
      process.env.VERCEL_ENV === "preview" ? "true" : "false",
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
