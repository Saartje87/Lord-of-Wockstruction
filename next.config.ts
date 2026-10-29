import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // PROTOTYPE: lets a phone on the same Wi-Fi load the 3D spike from `next dev`.
  allowedDevOrigins: ["192.168.178.107"],
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
