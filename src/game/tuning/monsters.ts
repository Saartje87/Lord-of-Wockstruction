/**
 * Monster tuning, in human units. The sim converts it to steps once. The
 * Skeleton's numbers are the final knobs of the Monster behaviour prototype
 * (#82), with the damage from the combat numbers (#83).
 */
export type MonsterTuning = {
  /** Shown on the nameplate. */
  name: string;
  life: number;
  /** Experience the Hero gains for killing one. */
  experience: number;
  /** Chase speed, in tiles per second. */
  speed: number;
  /** Damage per hit, rolled from `[min, max]` inclusive. */
  damage: [number, number];
  /** Set against the Hero's Attack Rating for the chance to hit it. */
  defense: number;
  /** Set against the Hero's Defense for its chance to hit them. */
  attackRating: number;
  /** How big a Monster is when pushed apart from others (tiles). */
  radius: number;
  /** How far an idle Monster strolls from its spawn (tiles). */
  wanderRadius: number;
  /** Stroll speed, as a fraction of `speed`. */
  wanderSpeed: number;
  /** How long an idle Monster pauses between strolls, `[min, max]` (ms). */
  wanderPauseMs: [number, number];
  /** How near the Hero must come to be noticed (tiles). */
  aggroRadius: number;
  /** While walking around walls, how often a Monster re-plans its path (ms). */
  replanMs: number;
  /** Whether walls hide the Hero from a Monster. */
  needsSight: boolean;
  /** How near idle Monsters must be to wake with one that notices (tiles). */
  spreadRadius: number;
  /** How near the Hero must be to start an attack (tiles). */
  reach: number;
  /**
   * How much further the Hero may get during the wind-up and still be hit
   * (tiles).
   */
  reachGrace: number;
  /** An attack hits the Hero within this of the facing it wound up in. */
  arcDegrees: number;
  /** The telegraph before an attack's hit (ms). */
  windUpMs: number;
  /** How long a Monster is rooted after its hit (ms). */
  rootMs: number;
  /** The wait after rooting before it can attack again (ms). */
  recoveryMs: number;
  /** Up to this much random extra wait, so a pack doesn't swing in sync (ms). */
  jitterMs: number;
  /** How many Monsters may wind up at once; 0 for no cap. */
  maxAttackers: number;
  /** How far from its spawn a Monster chases before giving up (tiles). */
  leash: number;
  /** Walking home speed, as a multiple of `speed`. */
  returnSpeed: number;
  /** After getting home, how long before it can notice the Hero again (ms). */
  graceMs: number;
  /** The chance a hit makes it flinch. */
  flinchChance: number;
  flinchMs: number;
  /** Whether a flinch cancels a wind-up. */
  flinchInterrupts: boolean;
  /**
   * How much each number above, as at Monster Level 1, grows by for every
   * Monster Level above 1, as a fraction of its Monster Level 1 value: 0.25
   * adds a quarter of it per Monster Level. Each end of `damage` grows alike.
   * The rest of the type's numbers stay the same at every Monster Level.
   */
  growth: MonsterGrowth;
};

/** A growth rate per Monster Level for each number that scales with it. */
export type MonsterGrowth = {
  life: number;
  damage: number;
  attackRating: number;
  defense: number;
  experience: number;
};

export type MonsterType = "skeleton";

export const monsterTuning: Record<MonsterType, MonsterTuning> = {
  skeleton: {
    name: "Skeleton",
    life: 60,
    experience: 100,
    speed: 2.8,
    damage: [4, 8],
    // A fresh Hero's 100 Attack Rating hits it 85% of the time.
    defense: 135,
    // Leather Armour's 27 Defense makes it Miss 15% of the time, and a Hero
    // with 0 Defense is always hit.
    attackRating: 20,
    radius: 0.32,
    wanderRadius: 2.5,
    wanderSpeed: 0.35,
    wanderPauseMs: [1000, 3500],
    aggroRadius: 7,
    replanMs: 400,
    needsSight: true,
    spreadRadius: 1.5,
    reach: 1.2,
    reachGrace: 0.25,
    arcDegrees: 60,
    windUpMs: 400,
    rootMs: 200,
    recoveryMs: 1000,
    jitterMs: 400,
    maxAttackers: 0,
    leash: 14,
    returnSpeed: 1.2,
    graceMs: 2000,
    flinchChance: 0.35,
    flinchMs: 200,
    flinchInterrupts: false,
    // Defaults to check in a playtest: in the Crypt (Area Level 4) a Skeleton
    // has 105 Life and hits for 6–13; in the Ossuary (8), 165 and 10–19.
    growth: {
      life: 0.25,
      damage: 0.2,
      attackRating: 0.3,
      defense: 0.15,
      // Against Skeletons of the Hero's own Level, 2.5–8 kills per Level up
      // to Level 14, as 5 take a fresh Hero to Level 2. The Experience table
      // grows too fast after that for one rate to keep up.
      experience: 3,
    },
  },
};

export function isMonsterType(value: unknown): value is MonsterType {
  return typeof value === "string" && Object.hasOwn(monsterTuning, value);
}
