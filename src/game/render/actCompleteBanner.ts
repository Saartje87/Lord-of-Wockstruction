import type { Vec } from "../sim/vec";
import type { SimEvent } from "../sim/world";
import { areaTuning } from "../tuning/areas";
import type { Viewport } from "../viewport";

/**
 * The Act Complete banner (CSS px at native scale, drawn at the UI Scale):
 * text `size` tall in a black outline `stroke` wide, centred `top` of the way
 * down the screen. Bigger than the Area Banner, and lower, so the two don't
 * collide.
 */
export const ACT_COMPLETE_BANNER = { size: 76, stroke: 7, top: 0.4 };

/** Where the Act Complete banner's text is centred, and how big it is drawn. */
export function actCompleteLayout(screen: Viewport): {
  at: Vec;
  size: number;
  stroke: number;
} {
  return {
    at: {
      x: screen.width / 2,
      y: Math.round(screen.height * ACT_COMPLETE_BANNER.top),
    },
    size: ACT_COMPLETE_BANNER.size * screen.uiScale,
    stroke: ACT_COMPLETE_BANNER.stroke * screen.uiScale,
  };
}

/** `number` as a Roman numeral, for the Acts there will be. */
function romanOf(number: number): string {
  const numerals: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = number;
  let roman = "";
  for (const [value, numeral] of numerals) {
    while (rest >= value) {
      roman += numeral;
      rest -= value;
    }
  }
  return roman;
}

/**
 * The text to show in the Act Complete banner for a step's events, such as
 * "Act I Complete", or null when no Act was completed in it.
 */
export function actCompletedText(events: readonly SimEvent[]): string | null {
  let text: string | null = null;
  for (const event of events) {
    if (event.type === "ActCompleted") {
      text = `Act ${romanOf(event.act)} Complete`;
    }
  }
  return text;
}

/**
 * How opaque the Act Complete banner is (0..1), `ageMs` after the Act was
 * completed; null once it's gone. It fades in, holds and fades out over its
 * tuned times.
 */
export function actCompleteOpacityAt(ageMs: number): number | null {
  const { actBannerFadeInMs, actBannerHoldMs, actBannerFadeOutMs } = areaTuning;
  if (ageMs < actBannerFadeInMs) return ageMs / actBannerFadeInMs;
  const fadingFor = ageMs - actBannerFadeInMs - actBannerHoldMs;
  if (fadingFor <= 0) return 1;
  if (fadingFor >= actBannerFadeOutMs) return null;
  return 1 - fadingFor / actBannerFadeOutMs;
}
