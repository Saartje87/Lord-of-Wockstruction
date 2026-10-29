import { TILE_HEIGHT, TILE_WIDTH } from "../iso";

/**
 * A Corpse bursting: its length (ms), a pale gold flash at the Corpse
 * swelling from `flashFrom` to `flashShare` of the radius and fading fast,
 * and a blood-red ring of `ringWidth` (CSS px) spreading out to the radius
 * as it fades.
 */
export const CORPSE_BURST = {
  ms: 450,
  flashColour: 0xffd27a,
  flashFrom: 0.3,
  flashShare: 0.5,
  ringColour: 0xb3202a,
  ringWidth: 6,
};

/** An oval flat on the floor (CSS px), and how opaque it's drawn. */
export type FloorOval = { radiusX: number; radiusY: number; alpha: number };

/**
 * How a Corpse bursting over `radius` tiles looks `ms` after it burst, or
 * null once it has played: its flash and ring, each flat on the floor
 * round the Corpse.
 */
export function corpseBurst(
  ms: number,
  radius: number,
): { flash: FloorOval; ring: FloorOval } | null {
  const { ms: length, flashFrom, flashShare } = CORPSE_BURST;
  if (ms >= length) return null;
  const t = Math.max(0, ms) / length;
  // Easing out, so the ring bursts fast and slows as it reaches the edge.
  const spread = 1 - (1 - t) ** 3;
  return {
    flash: onFloor(
      radius * (flashFrom + (flashShare - flashFrom) * spread),
      (1 - t) ** 2,
    ),
    ring: onFloor(radius * spread, 1 - t),
  };
}

/** The radius in tiles of a circle that `onFloor` drew as `oval`. */
export function tileRadiusOf(oval: FloorOval): number {
  return (oval.radiusX * Math.SQRT2) / TILE_WIDTH;
}

/** A tile-space circle of `radius` on the floor, as the screen shows it. */
export function onFloor(radius: number, alpha: number): FloorOval {
  return {
    radiusX: (radius * TILE_WIDTH) / Math.SQRT2,
    radiusY: (radius * TILE_HEIGHT) / Math.SQRT2,
    alpha,
  };
}
