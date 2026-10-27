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
 * having one of it; raise one from a Corpse (see `RaiseEffect`); burst a
 * Corpse (see `ExplodeEffect`); or Curse Monsters (see `CurseEffect`).
 */
export type SkillEffect =
  | { type: "summon"; minion: MinionType }
  | RaiseEffect
  | ExplodeEffect
  | CurseEffect;

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

/**
 * Burst the Corpse nearest the cast point, using it up. Every Monster within
 * `radius` of it, and `radiusPerSkillLevel` more each Skill Level past the
 * first (tiles), takes a roll of `share` (least and most) of the dead
 * Monster's max Life at its Monster Level.
 */
export type ExplodeEffect = {
  type: "explode";
  radius: number;
  radiusPerSkillLevel: number;
  share: [number, number];
};

/**
 * Curse every Monster within `radius` of the cast point, and
 * `radiusPerSkillLevel` more each Skill Level past the first (tiles), for
 * `durationMs`, and `durationMsPerSkillLevel` more each Skill Level past the
 * first. A Cursed Monster takes `damageTaken` times the damage.
 */
export type CurseEffect = {
  type: "curse";
  radius: number;
  radiusPerSkillLevel: number;
  durationMs: number;
  durationMsPerSkillLevel: number;
  damageTaken: number;
};

/** Skills that use a Corpse up. */
export const corpseTuning = {
  /** How near the cast point a Corpse must lie to be used (tiles). */
  reach: 2,
};

/** One of the Skills, by the name the sim and the Save know it by. */
export type Skill =
  | "golem"
  | "raiseSkeleton"
  | "amplifyDamage"
  | "corpseExplosion";

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
  // Diablo 2's Amplify Damage: +100% damage taken there, softened to +50%.
  amplifyDamage: {
    name: "Amplify Damage",
    requiredLevel: 2,
    manaCost: 4,
    manaCostPerSkillLevel: 0,
    castMs: 400,
    effect: {
      type: "curse",
      radius: 2,
      radiusPerSkillLevel: 0.5,
      durationMs: 8000,
      durationMsPerSkillLevel: 2000,
      damageTaken: 1.5,
    },
  },
  // Diablo 2's Corpse Explosion: 60–100% of the dead Monster's max Life.
  corpseExplosion: {
    name: "Corpse Explosion",
    requiredLevel: 4,
    manaCost: 15,
    manaCostPerSkillLevel: 1,
    castMs: 400,
    effect: {
      type: "explode",
      radius: 2,
      radiusPerSkillLevel: 0.25,
      share: [0.6, 1],
    },
  },
};
