import { inputTuning } from "../tuning/input";

/** One mote of the click marker's puff. */
export type Mote = {
  /** Where it is from the click point, in the floor plane (tiles). */
  offset: { x: number; y: number };
  /** How high above the floor (tiles). */
  height: number;
  /** How big it is (tiles across). */
  size: number;
  /** How opaque it is (0..1). */
  opacity: number;
};

/** A small seeded random source (mulberry32), so a point always scatters alike. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed from the click point. */
function seedOf(at: { x: number; y: number }): number {
  const x = Math.round(at.x * 1000);
  const y = Math.round(at.y * 1000);
  return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
}

/**
 * The bone-ash puff `progress` (0..1) of the way through the click marker,
 * for a click at `at`: each mote's offset, height, size and opacity. The
 * scatter is seeded from the point, so the same click always gives the same
 * puff. Most of the spread happens early; everything is gone at 1.
 */
export function puffOf(at: { x: number; y: number }, progress: number): Mote[] {
  const { motes, reach, rise, size } = inputTuning.clickPuff;
  const random = seeded(seedOf(at));
  const eased = 1 - (1 - progress) ** 3;
  const turn = random() * Math.PI * 2;
  return Array.from({ length: motes }, (_, i) => {
    const angle = turn + ((i + 0.6 * random()) / motes) * Math.PI * 2;
    const far = reach * (0.55 + 0.45 * random());
    const up = rise * (0.4 + 0.6 * random());
    const mote = size * (0.7 + 0.3 * random());
    return {
      offset: {
        x: Math.cos(angle) * far * eased,
        y: Math.sin(angle) * far * eased,
      },
      height: up * eased,
      size: mote * (1 - 0.4 * progress),
      opacity: Math.max(0, 1 - progress),
    };
  });
}
