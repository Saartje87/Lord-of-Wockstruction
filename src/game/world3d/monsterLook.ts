import type { MonsterType } from "../tuning/monsters";
import { ATTACK_CONTACT } from "./clips";
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
    contact: ATTACK_CONTACT,
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
    // Not the melee swing's: the crossbow is raised and fired by about
    // 0.3 of the clip, where the arms stop moving fast (from its keyframes).
    contact: 0.3,
    weapons: [{ slot: "handslot.r", model: "Skeleton_Crossbow" }],
  },
  // The Werewolf (KayKit Mystery Monthly Series 4) in its wolf form, smaller
  // than the Golem's Monstrosity; its clips come from `Rig_Medium`, the
  // attack from the Knight's chop.
  wockwolf: {
    model: "Werewolf",
    scale: 0.32,
    height: 0.75,
    clips: {
      idle: "Idle_A",
      walk: "Walking_A",
      run: "Running_A",
      attack: "1H_Melee_Attack_Chop",
      flinch: "Hit_A",
      death: "Death_A",
    },
    contact: ATTACK_CONTACT,
    weapons: [],
  },
  // The Plant Warrior (KayKit Mystery Monthly Series 6), a slow plant that
  // spits Muck. Its clips come from `Rig_Medium`, the spit from the Knight's
  // `Spellcast_Shoot`.
  bog_spitter: {
    model: "PlantWarrior",
    scale: 0.36,
    height: 1,
    clips: {
      idle: "Idle_A",
      walk: "Walking_A",
      // It never runs: a chase is the same shamble.
      run: "Walking_A",
      attack: "Spellcast_Shoot",
      flinch: "Hit_A",
      death: "Death_A",
    },
    // Placeholder until sampled against the clip: the spit leaves the hands
    // at about half the cast.
    contact: 0.5,
    weapons: [],
  },
  // The Orc Brute (KayKit Mystery Monthly Series 6), larger than the Golem's
  // Monstrosity on the same `Rig_Large`. Its Slam is the Knight's 2-handed
  // chop retargeted onto it, as the Golem's is.
  wockbrute: {
    model: "OrcBrute",
    scale: 0.38,
    height: 1.6,
    clips: {
      idle: "Idle_A",
      walk: "Walking_A",
      // At 1.2 tiles/s a chase is the same lumber.
      run: "Walking_A",
      attack: "2H_Melee_Attack_Chop",
      flinch: "Hit_A",
      death: "Death_A",
    },
    // The slam stops dead at about 0.55 of its clip (hand speed sampled along
    // the retargeted clip on the Orc Brute: 14 tiles/s at 0.533, 1 at 0.55).
    contact: 0.55,
    weapons: [],
  },
  // A big, pale Skeleton with a blade for a staff, until he has a model of his own.
  grave_wockington: {
    model: "Skeleton",
    scale: 0.6,
    height: 1.5,
    clips: { ...STANDING, attack: "1H_Melee_Attack_Chop" },
    contact: ATTACK_CONTACT,
    look: "raised",
    weapons: [{ slot: "handslot.r", model: "Skeleton_Blade" }],
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
    contact: ATTACK_CONTACT,
    weapons: [],
  },
};

/** How long the Monsters' death clip lasts, seconds (`Death_A`). */
export const MONSTER_DEATH_SECONDS = 0.8;
