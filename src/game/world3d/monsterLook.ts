import type { MonsterType } from "../tuning/monsters";
import type { LOOKS } from "./toon";

/** The Monster animations as the 3D World view names them. */
export type MonsterClip =
  | "idle"
  | "walk"
  | "run"
  | "attack"
  | "flinch"
  | "death";

/** How one Monster type is drawn. */
export type MonsterLook = {
  /** The model file in `characters/`. */
  model: string;
  /** How big the model is drawn, as the Hero's `HERO_SCALE` is. */
  scale: number;
  /** How tall it stands in tiles, which its picking box follows. */
  height: number;
  /** The KayKit clip that plays each of its animations. */
  clips: Record<MonsterClip, string>;
  /**
   * How far into its attack clip the weapon makes contact (0..1): the
   * wind-up scrubs the clip to here, the recovery plays the rest.
   */
  contact: number;
  /** How its colours are graded; a character's own by default. */
  look?: keyof typeof LOOKS;
  /** Weapon files in `characters/`, by the hand slot that holds them. */
  weapons: { slot: "handslot.r" | "handslot.l"; model: string }[];
};

/** The clips the standing, walking and hurt Skeletons share. */
export const STANDING = {
  idle: "Idle_Combat",
  walk: "Walking_A",
  run: "Running_C",
  flinch: "Hit_B",
  death: "Death_A",
};

/** What each Monster type looks like. */
export const MONSTER_LOOKS: Record<MonsterType, MonsterLook> = {
  skeleton: {
    model: "Skeleton",
    scale: 0.36,
    height: 0.9,
    clips: { ...STANDING, attack: "1H_Melee_Attack_Chop" },
    contact: 0.42,
    weapons: [
      { slot: "handslot.r", model: "Skeleton_Blade" },
      { slot: "handslot.l", model: "Skeleton_Shield_Small_A" },
    ],
  },
  skeleton_archer: {
    model: "SkeletonArcher",
    scale: 0.36,
    height: 0.9,
    clips: { ...STANDING, attack: "2H_Ranged_Shoot" },
    // Not the melee swing's 0.42: the crossbow is raised and fired by about
    // 0.3 of the clip, where the arms stop moving fast (from its keyframes).
    contact: 0.3,
    weapons: [{ slot: "handslot.r", model: "Skeleton_Crossbow" }],
  },
  zombie: {
    model: "Zombie",
    scale: 0.4,
    height: 1,
    // Shambles rather than runs.
    clips: {
      ...STANDING,
      idle: "Idle",
      walk: "Walking_D_Skeletons",
      run: "Walking_D_Skeletons",
      attack: "1H_Melee_Attack_Chop",
    },
    contact: 0.42,
    weapons: [],
  },
};

/** How long the Monsters' death clip lasts, seconds (`Death_A`). */
export const MONSTER_DEATH_SECONDS = 0.8;
