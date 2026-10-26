import { viewportTuning } from "./tuning/viewport";

/** The screen's size in CSS px, as the renderer reads it each frame. */
export type Screen = { width: number; height: number };

/**
 * What the screen's size decides for everything drawn: the screen itself
 * (CSS px), the UI Scale the HUD is drawn at and the World zoom. Layout
 * functions take this rather than the bare screen.
 */
export type Viewport = Screen & {
  /** How many times native size the HUD and panels are drawn. */
  uiScale: number;
  /**
   * How many times native size the World is drawn, so about as many tiles
   * show top to bottom as at the reference height.
   */
  worldZoom: number;
};

/**
 * The viewport for a screen `screen` CSS px: the UI Scale and the World
 * zoom follow its height against the reference height, each held within
 * its tuned limits.
 */
export function viewportOf(screen: Screen): Viewport {
  const {
    referenceHeight,
    minUiScale,
    maxUiScale,
    minWorldZoom,
    maxWorldZoom,
  } = viewportTuning;
  const byHeight = screen.height / referenceHeight;
  return {
    width: screen.width,
    height: screen.height,
    uiScale: clamp(byHeight, minUiScale, maxUiScale),
    worldZoom: clamp(byHeight, minWorldZoom, maxWorldZoom),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
