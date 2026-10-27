import type { Vec } from "./sim/vec";
import { type MonsterId, maxLife, type World } from "./sim/world";
import type { MonsterType } from "./tuning/monsters";

/** What a playtest reads of the game: see `docs/agents/playtesting.md`. */
export type DevState = {
  area: string;
  hero: {
    pos: Vec;
    facing: number;
    life: number;
    maxLife: number;
    experience: number;
  };
  /** The Monster the game highlights as the Target, if any. */
  target: MonsterId | null;
  monsters: { id: MonsterId; type: MonsterType; pos: Vec; life: number }[];
};

declare global {
  interface Window {
    /** Dev builds only: see `GameCanvas`. */
    __wiablo?: { state: () => DevState };
  }
}

/**
 * A plain copy of the World's Area, Hero and Monsters, with the `target`
 * picked in input (ADR 0002), or none once it is dead, as the renderer
 * highlights none then. Nothing in it refers back into the World.
 * Dev builds only: see `GameCanvas`.
 */
export function devStateOf(world: World, target: MonsterId | null): DevState {
  const { hero } = world;
  return {
    area: world.areaName,
    hero: {
      pos: { ...hero.pos },
      facing: hero.facing,
      life: hero.life,
      maxLife: maxLife(world),
      experience: hero.progress.experience,
    },
    target: world.monsters.some(({ id }) => id === target) ? target : null,
    monsters: world.monsters.map(({ id, type, pos, life }) => ({
      id,
      type,
      pos: { ...pos },
      life,
    })),
  };
}
