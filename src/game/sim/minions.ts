import { type MinionType, minionTuning } from "../tuning/minions";
import { type Area, isWalkable } from "./area";
import { isClear } from "./path";
import { msToSteps, perStep } from "./units";
import { distance, type Vec } from "./vec";
import { type Gait, goToward } from "./walking";
import type { World } from "./world";

export type { MinionType };

/** Unique within the World and never reused; apart from Monster ids. */
export type MinionId = number;

/**
 * What a Minion is doing. With nothing to fight it follows the Hero,
 * teleporting next to them when far behind or stuck.
 */
export type MinionState = "follow";

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
  state: MinionState;
  /** The waypoints it is walking around walls. */
  path: Vec[];
  /** Steps until it re-plans its path. */
  replan: number;
  /** Steps in a row it has hardly moved while trying to. */
  stuck: number;
};

/** Each Minion type's tuning converted to steps. */
const STEPPED = Object.fromEntries(
  Object.entries(minionTuning).map(([type, tuning]) => [
    type,
    {
      speed: perStep(tuning.speed),
      stuckSteps: msToSteps(tuning.stuckMs),
      gait: { radius: tuning.radius, replanSteps: msToSteps(tuning.replanMs) },
    },
  ]),
) as Record<MinionType, { speed: number; stuckSteps: number; gait: Gait }>;

/** A Minion's full Life, which it is summoned with. */
export function minionMaxLife(minion: Pick<Minion, "type">): number {
  return minionTuning[minion.type].life;
}

/**
 * A fresh Minion of `type` at `pos`, facing `facing`, following the Hero.
 */
export function newMinion(
  id: MinionId,
  type: MinionType,
  skillLevel: number,
  pos: Vec,
  facing: number,
): Minion {
  return {
    id,
    type,
    skillLevel,
    pos: { ...pos },
    prevPos: { ...pos },
    life: minionMaxLife({ type }),
    facing,
    state: "follow",
    path: [],
    replan: 0,
    stuck: 0,
  };
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

/** How far from the Hero a Minion is put beside them (tiles). */
const BESIDE = 1;

/**
 * Puts the Minion next to the Hero, facing their way, as if it had always
 * been there: behind them if it can walk straight there from the Hero, else
 * the nearest way round to it that it can, else on the Hero.
 */
export function placeBesideHero(world: World, minion: Minion) {
  const area = world.areas[world.areaName];
  const { pos, facing } = world.hero;
  const { radius } = minionTuning[minion.type];
  const at =
    [0, 1, -1, 2, -2, 3, -3, 4]
      .map((turn) => facing + Math.PI + (turn * Math.PI) / 4)
      .map((angle) => ({
        x: pos.x + BESIDE * Math.cos(angle),
        y: pos.y + BESIDE * Math.sin(angle),
      }))
      .find(
        (point) => isWalkable(area, point) && isClear(area, pos, point, radius),
      ) ?? pos;
  minion.pos = { ...at };
  minion.prevPos = { ...at };
  minion.facing = facing;
  minion.path = [];
  minion.replan = 0;
  minion.stuck = 0;
}

/** Moves the Hero's Minion, if any, one step. */
export function stepMinion(world: World) {
  const { minion } = world;
  if (!minion) return;
  switch (minion.state) {
    case "follow":
      follow(world, minion);
      break;
  }
}

/**
 * Walks after the Hero until within its follow distance with a clear line to
 * them, and teleports next to them when further than its teleport distance
 * or stuck for a while.
 */
function follow(world: World, minion: Minion) {
  const area = world.areas[world.areaName];
  const hero = world.hero.pos;
  const tuning = minionTuning[minion.type];
  const stepped = STEPPED[minion.type];
  const gap = distance(minion.pos, hero);
  if (gap > tuning.teleportDistance) {
    placeBesideHero(world, minion);
    return;
  }
  if (
    gap <= tuning.followDistance + 1e-9 &&
    isClear(area, minion.pos, hero, tuning.radius)
  ) {
    minion.path = [];
    minion.replan = 0;
    minion.stuck = 0;
    return;
  }
  const from = minion.pos;
  goToward(
    area,
    minion,
    stepped.gait,
    hero,
    stepped.speed,
    gap - tuning.followDistance,
  );
  // Short of half its stride counts as stuck; a walk ending at the follow
  // distance is over before this adds up.
  if (distance(from, minion.pos) < stepped.speed / 2) minion.stuck += 1;
  else minion.stuck = 0;
  if (minion.stuck >= stepped.stuckSteps) placeBesideHero(world, minion);
}
