import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * On iPhone and iPad, Add to Home Screen makes the Installed game: no
 * Safari around it, and the status bar drawn over black.
 */
export const metadata: Metadata = {
  title: "Wiablo",
  description: "A browser hack and slash action RPG",
  appleWebApp: {
    capable: true,
    title: "Wiablo",
    statusBarStyle: "black-translucent",
  },
};

/**
 * The game fills the screen, which pinching doesn't zoom. `viewport-fit=cover`
 * is left out, so the notch and rounded corners stay black bars and the HUD
 * never sits under them.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
