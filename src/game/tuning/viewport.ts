/** How the HUD and panels fit the screen, in human units. */
export type ViewportTuning = {
  /** The screen height the HUD is drawn at native scale on (CSS px). */
  referenceHeight: number;
  /** The smallest UI Scale, however short the screen. */
  minUiScale: number;
  /** The largest UI Scale, however tall the screen. */
  maxUiScale: number;
};

export const viewportTuning: ViewportTuning = {
  referenceHeight: 720,
  minUiScale: 0.75,
  maxUiScale: 1.5,
};
