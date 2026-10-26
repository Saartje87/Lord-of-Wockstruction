import { type MinionType, minionTuning } from "../tuning/minions";
import { type Area, isWalkable } from "./area";
import { distance, type Vec } from "./vec";

export type { MinionType };

/** Unique within the World and never reused; apart from Monster ids. */
export type MinionId = number;

/** A creature on the Hero's side, brought by a Skill. */
export type Minion = {
  id: MinionId;
  type: MinionType;
  /** The Skill Level of the Skill that summoned it. */
  skillLevel: number;
  pos: Vec;
  /** Where it was one step ago, for the renderer to interpolate from. */
  prevPos: Vec;
  /** Never regained. */
  life: number;
  /** Which way it faces, in radians in tile space. */
  facing: number;
};

/** A Minion's full Life, which it is summoned with. */
export function minionMaxLife(minion: Pick<Minion, "type">): number {
  return minionTuning[minion.type].life;
}

/**
 * Where a Minion of `radius` summoned at `point` stands: there if walkable,
 * else the nearest point to it on a walkable tile, kept `radius` inside the
 * tile's edges. Null in an Area with nowhere walkable.
 */
export function summonPoint(
  area: Area,
  point: Vec,
  radius: number,
): Vec | null {
  if (isWalkable(area, point)) return { ...point };
  let nearest: Vec | null = null;
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      if (!isWalkable(area, { x, y })) continue;
      const clamped = {
        x: Math.min(x + 1 - radius, Math.max(x + radius, point.x)),
        y: Math.min(y + 1 - radius, Math.max(y + radius, point.y)),
      };
      if (!nearest || distance(clamped, point) < distance(nearest, point)) {
        nearest = clamped;
      }
    }
  }
  return nearest;
}
