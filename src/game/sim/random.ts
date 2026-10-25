/**
 * A seeded PRNG (mulberry32) whose whole state is one 32-bit integer, so it
 * can live in World state and a fight replays identically from its seed.
 */
export type Rng = { state: number };

export function createRng(seed: number): Rng {
  return { state: seed | 0 };
}

/** A float in [0, 1), advancing `rng`. */
export function random(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) | 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** An integer in `[min, max]` inclusive, advancing `rng`. */
export function randomInt(rng: Rng, [min, max]: [number, number]): number {
  return min + Math.floor(random(rng) * (max - min + 1));
}
