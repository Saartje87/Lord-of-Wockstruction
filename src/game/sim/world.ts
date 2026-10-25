import { type Area, loadArea } from "./area";
import type { Vec } from "./vec";

export type Hero = {
  pos: Vec;
  /** Where the Hero was one step ago, for the renderer to interpolate from. */
  prevPos: Vec;
};

export type World = {
  seed: number;
  /** Steps taken since the World was created. */
  tick: number;
  areas: Record<string, Area>;
  areaName: string;
  hero: Hero;
};

/** Input reaching the simulation. Later tickets add `MoveTo`, `Attack`, … */
export type Order = never;

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
    hero: { pos: { ...start }, prevPos: { ...start } },
  };
}

/** Advances the World by one fixed 1/60 s step. */
export function step(world: World, _orders: readonly Order[]): SimEvent[] {
  world.hero.prevPos = { ...world.hero.pos };
  world.tick += 1;
  return [];
}
