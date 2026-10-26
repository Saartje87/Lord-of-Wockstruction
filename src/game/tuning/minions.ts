/** Minion tuning, in human units. The sim converts it to steps once. */
export type MinionTuning = {
  /** Shown on the nameplate. */
  name: string;
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
};

/** A growth rate per Skill Level for each number that scales with it. */
export type MinionGrowth = {
  life: number;
  damage: number;
  attackRating: number;
  defense: number;
};

/** One of the Minions, by the name the sim knows it by. */
export type MinionType = "golem";

/** Every Minion's tuning. */
export const minionTuning: Record<MinionType, MinionTuning> = {
  // Diablo 2's Clay Golem: slow and tanky, with about three Skeletons' Life.
  golem: {
    name: "Golem",
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
    reachGrace: 0.25,
    arcDegrees: 60,
    // A slower swing than a Skeleton's 400 ms wind-up, 200 ms root and
    // 1000 ms recovery.
    windUpMs: 600,
    rootMs: 300,
    recoveryMs: 1200,
  },
};
