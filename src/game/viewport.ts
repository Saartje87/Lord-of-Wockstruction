import { viewportTuning } from "./tuning/viewport";

/** The screen's size in CSS px, as the renderer reads it each frame. */
export type Screen = { width: number; height: number };

/**
 * What the screen's size decides for everything drawn over the World: the
 * screen itself (CSS px) and the UI Scale the HUD is drawn at. Layout
 * functions take this rather than the bare screen.
 */
export type Viewport = Screen & {
  /** How many times native size the HUD and panels are drawn. */
  uiScale: number;
};

/**
 * The viewport for a screen `screen` CSS px: the UI Scale follows its
 * height against the reference height, held within the tuned limits.
 */
export function viewportOf(screen: Screen): Viewport {
  const { referenceHeight, minUiScale, maxUiScale } = viewportTuning;
  const byHeight = screen.height / referenceHeight;
  return {
    width: screen.width,
    height: screen.height,
    uiScale: Math.min(maxUiScale, Math.max(minUiScale, byHeight)),
  };
}

/** Every size in `sizes`, given at native scale, at the UI Scale `uiScale`. */
export function atUiScale<Sizes extends Record<string, number>>(
  sizes: Sizes,
  uiScale: number,
): Sizes {
  return Object.fromEntries(
    Object.entries(sizes).map(([name, size]) => [name, size * uiScale]),
  ) as Sizes;
}
