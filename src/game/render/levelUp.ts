/**
 * The Hero's flash on reaching a new Level: its length (ms), fading out, how
 * strongly it washes them gold at the start (0..1), and a gold ring spreading
 * out at their feet to `ringRadius` (tiles), `ringWidth` wide (CSS px).
 */
export const LEVEL_UP = {
  ms: 800,
  strength: 0.7,
  colour: 0xffd75a,
  ringRadius: 1.4,
  ringWidth: 3,
};

/** How much of the Level-Up flash is left `ms` after it began (1..0). */
export function levelUpLeft(ms: number): number {
  return 1 - ms / LEVEL_UP.ms;
}

/**
 * The Level-Up ring `ms` after the Level was reached: its radius (tiles)
 * and how opaque it is, or null once it has played.
 */
export function levelRing(
  ms: number,
): { radius: number; alpha: number } | null {
  const left = levelUpLeft(ms);
  if (left <= 0) return null;
  return { radius: LEVEL_UP.ringRadius * (1 - left), alpha: left };
}
