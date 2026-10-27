import type { Vec } from "../sim/vec";
import type { SimEvent } from "../sim/world";
import { areaTuning } from "../tuning/areas";
import type { Viewport } from "../viewport";

/**
 * The Area Banner (CSS px at native scale, drawn at the UI Scale): text
 * `size` tall in a black outline `stroke` wide, centred `top` of the way
 * down the screen.
 */
export const AREA_BANNER = { size: 34, stroke: 4, top: 0.22 };

/** Where the Area Banner's text is centred, and how big it is drawn. */
export function areaBannerLayout(screen: Viewport): {
  at: Vec;
  size: number;
  stroke: number;
} {
  return {
    at: { x: screen.width / 2, y: Math.round(screen.height * AREA_BANNER.top) },
    size: AREA_BANNER.size * screen.uiScale,
    stroke: AREA_BANNER.stroke * screen.uiScale,
  };
}

/**
 * The display name to show in the Area Banner for a step's events: that of the
 * Area the Hero arrived in, or null when they arrived nowhere.
 */
export function arrivedInDisplayName(
  events: readonly SimEvent[],
  displayNames: Readonly<Record<string, string>>,
): string | null {
  let banner: string | null = null;
  for (const event of events) {
    if (event.type === "AreaChanged") banner = displayNames[event.area];
  }
  return banner;
}

/**
 * How opaque the Area Banner is (0..1), `ageMs` after the Hero arrived;
 * null once it's gone. It fades in, holds and fades out over its tuned times.
 */
export function bannerOpacityAt(ageMs: number): number | null {
  const { bannerFadeInMs, bannerHoldMs, bannerFadeOutMs } = areaTuning;
  if (ageMs < bannerFadeInMs) return ageMs / bannerFadeInMs;
  const fadingFor = ageMs - bannerFadeInMs - bannerHoldMs;
  if (fadingFor <= 0) return 1;
  if (fadingFor >= bannerFadeOutMs) return null;
  return 1 - fadingFor / bannerFadeOutMs;
}
