import type { Resistances } from "./damage";
import type { MonsterType } from "./monsters";
import type { ProjectileKind } from "./projectiles";

/** Minion tuning, in human units. The sim converts it to steps once. */
export type MinionTuning = {
  /** Shown on the nameplate. */
  name: string;
  /** What it shrugs off of each Element's damage (see `Resistances`). */
  resistances?: Resistances;
  /**
   * A Minion named for a Monster takes that Monster type's `resistances` in
   * place of its own.
   */
  resistancesOf?: MonsterType;
  /** Life when summoned at Skill Level 1; it never regains any. */
  life: number;
  /** Damage per hit at Skill Level 1, rolled from `[min, max]` inclusive. */
  damage: [number, number];
  /** Set against a Monster's Defense for its chance to hit, at Skill Level 1. */
  attackRating: number;
  /** What Monsters' Attack Rating has to beat to hit it, at Skill Level 1. */
  defense: number;
  /**
   * How much each number above, as at Skill Level 1, grows by for every
   * Skill Level above 1, as a fraction of its Skill Level 1 value: 0.2 adds
   * a fifth of it per Skill Level. Each end of `damage` grows alike.
   */
  growth: MinionGrowth;
  /** How big it is: kept this far inside walls when summoned (tiles). */
  radius: number;
  /** Walking speed, in tiles per second. */
  speed: number;
  /**
   * With nothing to fight it walks after the Hero until this near, with a
   * clear line to them (tiles).
   */
  followDistance: number;
  /** Further than this from the Hero, it teleports next to them (tiles). */
  teleportDistance: number;
  /** How far from the Hero it lands when it teleports next to them (tiles). */
  besideDistance: number;
  /**
   * Walking less than this fraction of its speed in a step counts as stuck.
   */
  stuckStride: number;
  /** Stuck this long while walking, it teleports next to the Hero (ms). */
  stuckMs: number;
  /** While walking around walls, how often it re-plans its path (ms). */
  replanMs: number;
  /** It goes after Monsters this near the Hero, guarding them (tiles). */
  guardRadius: number;
  /**
   * Its Leash to the Hero: it gives up on a Monster further than this from
   * them (tiles).
   */
  leash: number;
  /** How near a Monster must be to start an attack (tiles). */
  reach: number;
  /**
   * How far past its reach, and both Bodies, a Monster still counts as a
   * fight, in which a Minion never teleports for being stuck (tiles).
   */
  fightRange: number;
  /**
   * How much further the Monster may get during the wind-up and still be
   * hit (tiles).
   */
  reachGrace: number;
  /** An attack hits a Monster within this of the facing it wound up in. */
  arcDegrees: number;
  /** The wind-up before an attack's hit (ms). */
  windUpMs: number;
  /** How long it is rooted after its hit (ms). */
  rootMs: number;
  /** The wait after rooting before it can attack again (ms). */
  recoveryMs: number;
  /**
   * Set for a Minion that shoots: it stops once a Monster is within
   * `range` and in sight, winds up, and looses a Projectile at where the
   * Monster then is, in place of a swing within `reach`.
   */
  shot?: MinionShot;
};

/** What a shooting Minion looses, and from how far. */
export type MinionShot = {
  /** What it looses. */
  projectile: ProjectileKind;
  /** How near a Monster must be, and in sight, to start an attack (tiles). */
  range: number;
  /** How fast its Projectile flies (tiles per second). */
  projectileSpeed: number;
  /** How far its Projectile flies before it vanishes (tiles). */
  projectileRange: number;
};

/** A growth rate per Skill Level for each number that scales with it. */
export type MinionGrowth = {
  life: number;
  damage: number;
  attackRating: number;
  defense: number;
};

/** One of the Minions, by the name the sim knows it by. */
export type MinionType = "golem" | "raisedSkeleton" | "raisedArcher";

/** Every Minion's tuning. */
export const minionTuning: Record<MinionType, MinionTuning> = {
  // Diablo 2's Clay Golem: slow and tanky, with about three Skeletons' Life.
  golem: {
    name: "Golem",
    resistances: { lightning: 50 },
    life: 180,
    // A Skeleton's.
    damage: [4, 8],
    // Hits a Monster Level 1 Skeleton (Defense 135) about 85% of the time.
    attackRating: 100,
    // A Monster Level 1 Skeleton hits it four times in five.
    defense: 30,
    growth: { life: 0.2, damage: 0.2, attackRating: 0.1, defense: 0.1 },
    radius: 0.4,
    // Slower than the Hero's 5.5, faster than a Skeleton's 2.8: it lags
    // behind a walking Hero and teleports to them now and then.
    speed: 4,
    followDistance: 3,
    teleportDistance: 12,
    besideDistance: 1,
    stuckStride: 0.5,
    stuckMs: 1000,
    replanMs: 400,
    guardRadius: 6,
    leash: 8,
    reach: 1.2,
    fightRange: 1,
    reachGrace: 0.25,
    arcDegrees: 60,
    // A slower swing than a Skeleton's 400 ms wind-up, 200 ms root and
    // 1000 ms recovery.
    windUpMs: 600,
    rootMs: 300,
    recoveryMs: 1200,
  },
  // Starts from a Monster Level 1 Skeleton's numbers, and its swing.
  raisedSkeleton: {
    name: "Raised Skeleton",
    resistancesOf: "skeleton",
    life: 60,
    damage: [4, 8],
    // Hits a Monster Level 1 Skeleton (Defense 135) about a quarter of the
    // time, as one hits another.
    attackRating: 20,
    // A Monster Level 1 Skeleton hits it about a quarter of the time.
    defense: 135,
    growth: { life: 0.2, damage: 0.2, attackRating: 0.1, defense: 0.1 },
    radius: 0.32,
    // The Golem's, so it keeps up with the Hero as well as the Golem does.
    speed: 4,
    followDistance: 3,
    teleportDistance: 12,
    besideDistance: 1,
    stuckStride: 0.5,
    stuckMs: 1000,
    replanMs: 400,
    guardRadius: 6,
    leash: 8,
    reach: 1.2,
    fightRange: 1,
    reachGrace: 0.25,
    arcDegrees: 60,
    windUpMs: 400,
    rootMs: 200,
    recoveryMs: 1000,
  },
  // Starts from a Monster Level 1 Skeleton Archer's numbers and its shot,
  // but keeps the Raised Skeleton's Attack Rating: it hits a Monster Level 1
  // Skeleton about a quarter of the time.
  raisedArcher: {
    name: "Raised Archer",
    resistancesOf: "skeleton_archer",
    life: 36,
    damage: [3, 6],
    attackRating: 20,
    defense: 135,
    growth: { life: 0.2, damage: 0.2, attackRating: 0.1, defense: 0.1 },
    radius: 0.32,
    speed: 4,
    followDistance: 3,
    teleportDistance: 12,
    besideDistance: 1,
    stuckStride: 0.5,
    stuckMs: 1000,
    replanMs: 400,
    guardRadius: 7,
    leash: 9,
    // Never swings; kept for how near a Monster counts as a fight.
    reach: 1.2,
    fightRange: 1,
    reachGrace: 0.25,
    arcDegrees: 60,
    // The Skeleton Archer's draw and recovery.
    windUpMs: 600,
    rootMs: 200,
    recoveryMs: 1600,
    shot: {
      projectile: "arrow",
      range: 6,
      projectileSpeed: 9,
      projectileRange: 10,
    },
  },
};
