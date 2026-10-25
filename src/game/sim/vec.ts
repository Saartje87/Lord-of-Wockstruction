/** A position or offset in tile units. */
export type Vec = { x: number; y: number };

/** The tile a point lies in; tile (i, j) covers [i, i+1). */
export function tileOf(point: Vec): Vec {
  return { x: Math.floor(point.x), y: Math.floor(point.y) };
}
