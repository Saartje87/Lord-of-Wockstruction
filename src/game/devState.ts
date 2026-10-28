import type { Vec } from "./sim/vec";
import {
  type BoneWard,
  type MinionId,
  type MinionType,
  type MonsterId,
  maxLife,
  maxMana,
  minionMaxLife,
  type Skill,
  type World,
} from "./sim/world";
import type { MonsterType } from "./tuning/monsters";

/** What a playtest reads of the game: see `docs/agents/playtesting.md`. */
export type DevState = {
  area: string;
  hero: {
    pos: Vec;
    facing: number;
    life: number;
    maxLife: number;
    mana: number;
    maxMana: number;
    /** What's left of the Bone Ward and its full amount, or none. */
    boneWard: BoneWard | null;
    experience: number;
  };
  /** How many tiles of the Area are Explored. */
  exploredTiles: number;
  /** The Monster the game highlights as the Target, if any. */
  target: MonsterId | null;
  monsters: { id: MonsterId; type: MonsterType; pos: Vec; life: number }[];
  corpses: {
    id: MonsterId;
    type: MonsterType;
    monsterLevel: number;
    pos: Vec;
  }[];
  minions: {
    id: MinionId;
    type: MinionType;
    /** The Skill that brought it. */
    skill: Skill;
    pos: Vec;
    life: number;
    maxLife: number;
  }[];
};

declare global {
  interface Window {
    /** Dev builds only: see `GameCanvas`. */
    __wiablo?: { state: () => DevState };
  }
}

/**
 * A plain copy of the World's Area, Hero, Monsters, Corpses and Minions,
 * with the `target` picked in input (ADR 0002), or none once it is dead, as
 * the renderer highlights none then. Nothing in it refers back into the World.
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
      mana: hero.mana,
      maxMana: maxMana(world),
      boneWard: hero.boneWard && { ...hero.boneWard },
      experience: hero.progress.experience,
    },
    exploredTiles: world.explored.filter(Boolean).length,
    target: world.monsters.some(({ id }) => id === target) ? target : null,
    monsters: world.monsters.map(({ id, type, pos, life }) => ({
      id,
      type,
      pos: { ...pos },
      life,
    })),
    corpses: world.corpses.map(({ id, type, monsterLevel, pos }) => ({
      id,
      type,
      monsterLevel,
      pos: { ...pos },
    })),
    minions: world.minions.map((minion) => ({
      id: minion.id,
      type: minion.type,
      skill: minion.skill,
      pos: { ...minion.pos },
      life: minion.life,
      maxLife: minionMaxLife(minion),
    })),
  };
}
