/** How the HUD, panels and World fit the screen, in human units. */
export type ViewportTuning = {
  /**
   * The screen height the HUD and World are drawn at native scale on (CSS
   * px).
   */
  referenceHeight: number;
  /** The smallest UI Scale, however short the screen. */
  minUiScale: number;
  /** The largest UI Scale, however tall the screen. */
  maxUiScale: number;
  /**
   * The smallest World zoom, however short the screen: below it the art
   * would be too small to read.
   */
  minWorldZoom: number;
  /**
   * The largest World zoom, however tall the screen: above it the pixel art
   * would be blown up blocky.
   */
  maxWorldZoom: number;
  /**
   * Below this screen height (CSS px), such as a phone held sideways, the
   * HUD and panels take the Compact Layout.
   */
  compactBelowHeight: number;
};

export const viewportTuning: ViewportTuning = {
  referenceHeight: 720,
  minUiScale: 0.75,
  maxUiScale: 1.5,
  minWorldZoom: 0.5,
  maxWorldZoom: 2,
  compactBelowHeight: 540,
};
