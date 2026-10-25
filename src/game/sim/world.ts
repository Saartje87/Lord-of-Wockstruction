import { heroTuning } from "../tuning/hero";
import { type Area, isFloor, loadArea } from "./area";
import { perStep } from "./units";
import type { Vec } from "./vec";

const WALK_PER_STEP = perStep(heroTuning.walkSpeed);

export type Hero = {
  pos: Vec;
  /** Where the Hero was one step ago, for the renderer to interpolate from. */
  prevPos: Vec;
  /** Where the Hero is walking to, or null when standing. */
  target: Vec | null;
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
    hero: { pos: { ...start }, prevPos: { ...start }, target: null },
  };
}

/** Advances the World by one fixed 1/60 s step. */
export function step(world: World, orders: readonly Order[]): SimEvent[] {
  const { hero } = world;
  hero.prevPos = { ...hero.pos };

  const area = world.areas[world.areaName];
  for (const order of orders) {
    if (!isFloor(area, order.target)) continue;
    hero.target = { ...order.target };
  }
  walk(hero);

  world.tick += 1;
  return [];
}

/** Moves the Hero one step in a straight line towards its target. */
function walk(hero: Hero) {
  if (!hero.target) return;
  const dx = hero.target.x - hero.pos.x;
  const dy = hero.target.y - hero.pos.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= WALK_PER_STEP) {
    hero.pos = { ...hero.target };
    hero.target = null;
    return;
  }
  hero.pos = {
    x: hero.pos.x + (dx / distance) * WALK_PER_STEP,
    y: hero.pos.y + (dy / distance) * WALK_PER_STEP,
  };
}
