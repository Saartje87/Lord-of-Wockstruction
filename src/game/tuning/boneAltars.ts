import type { MonsterType } from "./monsters";

/** Bone Altar tuning, in human units. The sim converts it to steps once. */
export type BoneAltarTuning = {
  /** How much damage it takes to destroy one. */
  life: number;
  /**
   * How big it is (tiles): the Hero's attacks and Projectiles reach this much
   * further to it than to a point, and a Minion reaches it from this far.
   */
  radius: number;
  /** How long it waits between raising Monsters (ms), the first wait too. */
  raiseEveryMs: number;
  /** How many Monsters it raised can be alive at once. */
  raisedLimit: number;
  /** What it raises, each picked with equal odds, at the Area's Monster Level. */
  raises: readonly MonsterType[];
  /** How far from its middle a Monster it raises stands (tiles). */
  raiseDistance: number;
};

export const boneAltarTuning: BoneAltarTuning = {
  life: 60,
  radius: 0.5,
  raiseEveryMs: 8000,
  raisedLimit: 2,
  raises: ["zombie", "skeleton"],
  raiseDistance: 1.2,
};
