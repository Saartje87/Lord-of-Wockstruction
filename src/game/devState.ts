import type { SaveOptions } from "./devSave";
import { type Cell, type ItemId, inventoryOf } from "./sim/inventory";
import type { QuestStates } from "./sim/quests";
import type { Vec } from "./sim/vec";
import {
  type BoneWard,
  groundItemsOf,
  type MinionId,
  type MinionType,
  type MonsterId,
  maxLife,
  maxMana,
  minionMaxLife,
  type Skill,
  type World,
} from "./sim/world";
import type { ItemType, Rarity } from "./tuning/items";
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
  /** The Ground Item the game shows as the Item in Reach, if any. */
  itemInReach: ItemId | null;
  groundItems: { id: ItemId; type: ItemType; rarity: Rarity; pos: Vec }[];
  /** The Items in the Inventory, each with its top-left cell. */
  inventory: { id: ItemId; type: ItemType; rarity: Rarity; cell: Cell }[];
  /** The Monsters, each with its Unique Monster name or null. */
  monsters: {
    id: MonsterId;
    type: MonsterType;
    pos: Vec;
    life: number;
    unique: string | null;
  }[];
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
  /** How far each Quest has got, as `loadSave` takes it. */
  quests: QuestStates;
};

declare global {
  interface Window {
    /** Dev builds only: see `GameCanvas`. */
    __wockstruction?: {
      state: () => DevState;
      /** Writes the Save `options` describe, then reloads. */
      loadSave: (options?: SaveOptions) => void;
    };
  }
}

/**
 * A plain copy of the World's Area, Hero, Monsters, Corpses, Minions, Ground
 * Items, Inventory and Quests, with the `target` and `itemInReach` picked in
 * input (ADR 0002), each none once gone, as the renderer highlights none then.
 * Nothing in it refers back into the World. Dev builds only: see `GameCanvas`.
 */
export function devStateOf(
  world: World,
  target: MonsterId | null,
  itemInReach: ItemId | null = null,
): DevState {
  const lying = groundItemsOf(world);
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
    itemInReach: lying.some(({ item }) => item.id === itemInReach)
      ? itemInReach
      : null,
    groundItems: lying.map(({ item, pos }) => ({
      id: item.id,
      type: item.type,
      rarity: item.rarity,
      pos,
    })),
    inventory: inventoryOf(world).map(({ item, cell }) => ({
      id: item.id,
      type: item.type,
      rarity: item.rarity,
      cell,
    })),
    monsters: world.monsters.map(({ id, type, pos, life, unique }) => ({
      id,
      type,
      pos: { ...pos },
      life,
      unique,
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
    quests: structuredClone(hero.progress.quests),
  };
}
