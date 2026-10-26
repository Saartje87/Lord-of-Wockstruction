/** Minion tuning, in human units. The sim converts it to steps once. */
export type MinionTuning = {
  /** Shown on the nameplate. */
  name: string;
  /** Life when summoned at Skill Level 1; it never regains any. */
  life: number;
  /** How big it is: kept this far inside walls when summoned (tiles). */
  radius: number;
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
  },
};
