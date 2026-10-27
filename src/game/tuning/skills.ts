import type { MinionType } from "./minions";

/** Skill tuning, in human units. The sim converts it to steps once. */
export type SkillTuning = {
  /** Shown in the Skill Tree. */
  name: string;
  /** The Hero's Level from which a Skill Point can be spent on it. */
  requiredLevel: number;
  /** The Mana a cast costs at Skill Level 1. */
  manaCost: number;
  /** The Mana cost added by each Skill Level past the first. */
  manaCostPerSkillLevel: number;
  /** How long a cast roots the Hero (ms). */
  castMs: number;
  /** What a cast does, as it starts. */
  effect: SkillEffect;
};

/**
 * What a Skill's cast does: summon a Minion at the cast point, the Hero
 * having one of it; or raise one from a Corpse (see `RaiseEffect`).
 */
export type SkillEffect = { type: "summon"; minion: MinionType } | RaiseEffect;

/**
 * Raise a Minion from the Corpse nearest the cast point, using the Corpse
 * up. The Hero has up to `count` of it at Skill Level 1, and one more every
 * `countEvery` Skill Levels; raising one past that replaces the oldest.
 */
export type RaiseEffect = {
  type: "raise";
  minion: MinionType;
  count: number;
  countEvery: number;
};

/** Skills that use a Corpse up. */
export const corpseTuning = {
  /** How near the cast point a Corpse must lie to be used (tiles). */
  reach: 2,
};

/** One of the Skills, by the name the sim and the Save know it by. */
export type Skill = "golem" | "raiseSkeleton";

/** Every Skill's tuning. */
export const skillTuning: Record<Skill, SkillTuning> = {
  // Diablo 2's Clay Golem.
  golem: {
    name: "Golem",
    requiredLevel: 1,
    manaCost: 15,
    manaCostPerSkillLevel: 2,
    castMs: 400,
    effect: { type: "summon", minion: "golem" },
  },
  // Diablo 2's Raise Skeleton: 2 at Skill Level 1, one more at 4, 7, 10 …
  raiseSkeleton: {
    name: "Raise Skeleton",
    requiredLevel: 1,
    manaCost: 6,
    manaCostPerSkillLevel: 1,
    castMs: 400,
    effect: {
      type: "raise",
      minion: "raisedSkeleton",
      count: 2,
      countEvery: 3,
    },
  },
};
