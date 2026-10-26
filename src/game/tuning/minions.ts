/** Minion tuning, in human units. The sim converts it to steps once. */
export type MinionTuning = {
  /** Shown on the nameplate. */
  name: string;
  /** Life when summoned at Skill Level 1; it never regains any. */
  life: number;
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
  /** Stuck this long while following, it teleports next to the Hero (ms). */
  stuckMs: number;
  /** While walking around walls, how often it re-plans its path (ms). */
  replanMs: number;
};

/** One of the Minions, by the name the sim knows it by. */
export type MinionType = "golem";

/** Every Minion's tuning. */
export const minionTuning: Record<MinionType, MinionTuning> = {
  // Diablo 2's Clay Golem: slow and tanky, with about three Skeletons' Life.
  golem: {
    name: "Golem",
    life: 180,
    radius: 0.4,
    // Slower than the Hero's 5.5, faster than a Skeleton's 2.8: it lags
    // behind a walking Hero and teleports to them now and then.
    speed: 4,
    followDistance: 3,
    teleportDistance: 12,
    stuckMs: 1000,
    replanMs: 400,
  },
};
