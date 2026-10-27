import { type FloorOval, onFloor } from "./corpseBurst";

/**
 * A Curse being cast: its length (ms), and a dark violet circle flat on the
 * floor over the whole radius, a faint fill inside a ring of `ringWidth`
 * (CSS px), fading out.
 */
export const CURSE_CIRCLE = {
  ms: 700,
  colour: 0x8a3fc2,
  fillAlpha: 0.2,
  ringWidth: 4,
};

/**
 * The mark over a Cursed Monster's head: a violet diamond `size` across,
 * edged `outlineWidth` wide in `outline`, its foot `gap` above where its
 * Life bar is drawn (CSS px), pulsing between `minAlpha` and fully opaque
 * every `pulseMs`.
 */
export const CURSE_MARK = {
  colour: 0xb05ce6,
  outline: 0x1a0826,
  outlineWidth: 1.5,
  size: 10,
  gap: 12,
  minAlpha: 0.6,
  pulseMs: 1200,
};

/**
 * How a Curse cast over `radius` tiles looks `ms` after it was cast, or null
 * once it has played.
 */
export function curseCircle(ms: number, radius: number): FloorOval | null {
  if (ms >= CURSE_CIRCLE.ms) return null;
  const played = Math.max(0, ms) / CURSE_CIRCLE.ms;
  // Easing in, so it holds a while before it fades.
  return onFloor(radius, 1 - played ** 2);
}

/** How opaque a Curse's mark is drawn at `ms`. */
export function curseMarkAlpha(ms: number): number {
  const { minAlpha, pulseMs } = CURSE_MARK;
  const wave = (1 + Math.cos((2 * Math.PI * ms) / pulseMs)) / 2;
  return minAlpha + (1 - minAlpha) * wave;
}
