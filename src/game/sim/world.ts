import { heroTuning } from "../tuning/hero";
import { type Area, loadArea } from "./area";
import { findPath } from "./path";
import { perStep } from "./units";
import type { Vec } from "./vec";

const WALK_PER_STEP = perStep(heroTuning.walkSpeed);

export type Hero = {
  pos: Vec;
  /** Where the Hero was one step ago, for the renderer to interpolate from. */
  prevPos: Vec;
  /** Waypoints still to walk through, in order; empty when standing. */
  path: Vec[];
  /**
   * Which way the Hero faces, in radians in tile space: `atan2(dy, dx)` of
   * the direction last walked.
   */
  facing: number;
};

export type World = {
  seed: number;
  /** Steps taken since the World was created. */
  tick: number;
  areas: Record<string, Area>;
  areaName: string;
  hero: Hero;
};

/** Input reaching the simulation. Later tickets add `Attack`, … */
export type Order = { type: "MoveTo"; target: Vec };

/** What happened during a step. Later tickets add `HitLanded`, … */
export type SimEvent = never;

const TOWN = "town";

/**
 * Builds a World from raw `.tmj` content keyed by Area name, with the Hero in
 * Town at its `start` Entry.
 */
export function createWorld(options: {
  areas: Record<string, unknown>;
  seed: number;
}): World {
  const areas: Record<string, Area> = {};
  for (const [name, content] of Object.entries(options.areas)) {
    areas[name] = loadArea(name, content);
  }

  const town = areas[TOWN];
  if (!town) throw new Error(`No Area named "${TOWN}"`);
  const start = town.entries.start;
  if (!start) throw new Error(`Area "${TOWN}" has no "start" Entry`);

  return {
    seed: options.seed,
    tick: 0,
    areas,
    areaName: TOWN,
    hero: {
      pos: { ...start },
      prevPos: { ...start },
      path: [],
      // Down the screen, along +x and +y.
      facing: Math.PI / 4,
    },
  };
}

/** Advances the World by one fixed 1/60 s step. */
export function step(world: World, orders: readonly Order[]): SimEvent[] {
  const { hero } = world;
  hero.prevPos = { ...hero.pos };

  const area = world.areas[world.areaName];
  for (const order of orders) {
    hero.path = findPath(area, hero.pos, order.target, heroTuning.radius);
  }
  walk(hero);

  world.tick += 1;
  return [];
}

/** Moves the Hero one step along its path, carrying over past waypoints. */
function walk(hero: Hero) {
  let budget = WALK_PER_STEP;
  while (budget > 0 && hero.path.length > 0) {
    const next = hero.path[0];
    const dx = next.x - hero.pos.x;
    const dy = next.y - hero.pos.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0) hero.facing = Math.atan2(dy, dx);
    if (distance <= budget) {
      hero.pos = { ...next };
      hero.path.shift();
      budget -= distance;
    } else {
      hero.pos = {
        x: hero.pos.x + (dx / distance) * budget,
        y: hero.pos.y + (dy / distance) * budget,
      };
      budget = 0;
    }
  }
}
