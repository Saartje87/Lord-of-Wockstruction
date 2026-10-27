import type { MetadataRoute } from "next";

/**
 * What lets the browser install the game as an Installed game: opened from
 * its own icon, fullscreen and sideways where the platform allows, launching
 * on black. There's no service worker, so each launch loads the game from
 * the network, as the website does.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wiablo",
    short_name: "Wiablo",
    description: "A browser hack and slash action RPG",
    start_url: "/",
    scope: "/",
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    orientation: "landscape",
    background_color: "#000000",
    theme_color: "#000000",
    // The fiery eye from the logo in `content/branding`; the maskable one is
    // padded so its horns sit inside the launcher's safe zone.
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
