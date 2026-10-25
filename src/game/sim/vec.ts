/** A position or offset in tile units. */
export type Vec = { x: number; y: number };

/** The tile a point lies in; tile (i, j) covers [i, i+1). */
export function tileOf(point: Vec): Vec {
  return { x: Math.floor(point.x), y: Math.floor(point.y) };
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The absolute difference between two angles, in [0, π]. */
export function angleBetween(a: number, b: number): number {
  const diff = Math.abs(a - b) % (2 * Math.PI);
  return diff > Math.PI ? 2 * Math.PI - diff : diff;
}
