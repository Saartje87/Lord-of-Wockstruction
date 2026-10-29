// Pure light maths, no three.js: which lit torches get the scene's few point
// lights (nearestLit) and how a flame flickers. lighting.ts owns the lights.

import type { Vec } from "../sim/vec";

/** Torches farther than this from the Hero (tiles) light nothing in view. */
const REACH = 14;

/**
 * The indices of the `pool` lit torches nearest `hero`, nearest first. The
 * scene owns a fixed number of point lights and hands them to these, so
 * shaders never recompile as the Hero walks.
 */
export function nearestLit(
  torches: { pos: Vec; lit: boolean }[],
  hero: Vec,
  pool: number,
): number[] {
  return torches
    .map((torch, i) => ({
      i,
      lit: torch.lit,
      apart: Math.hypot(torch.pos.x - hero.x, torch.pos.y - hero.y),
    }))
    .filter(({ lit, apart }) => lit && apart <= REACH)
    .sort((a, b) => a.apart - b.apart)
    .slice(0, pool)
    .map(({ i }) => i);
}

/**
 * How strong a flame burns `seconds` in, around 1: two waves of different
 * speeds, offset by `seed` so torches don't flicker together.
 */
export function flicker(seconds: number, seed: number): number {
  return (
    0.85 +
    0.1 * Math.sin(seconds * 9 + seed) +
    0.07 * Math.sin(seconds * 23 + seed * 3)
  );
}
