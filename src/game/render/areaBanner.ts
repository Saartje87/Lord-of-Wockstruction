import type { SimEvent } from "../sim/world";
import { areaTuning } from "../tuning/areas";

/**
 * The display name to show in a banner for a step's events: that of the
 * Area the Hero arrived in, or null when they arrived nowhere.
 */
export function areaBanner(
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
 * How opaque the Area-name banner is (0..1), `ageMs` after the Hero arrived;
 * null once it's gone. It fades in, holds and fades out over its tuned times.
 */
export function bannerAt(ageMs: number): number | null {
  const { bannerFadeInMs, bannerHoldMs, bannerFadeOutMs } = areaTuning;
  if (ageMs < bannerFadeInMs) return ageMs / bannerFadeInMs;
  const fadingFor = ageMs - bannerFadeInMs - bannerHoldMs;
  if (fadingFor <= 0) return 1;
  if (fadingFor >= bannerFadeOutMs) return null;
  return 1 - fadingFor / bannerFadeOutMs;
}
