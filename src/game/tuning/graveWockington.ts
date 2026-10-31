import type { MonsterType } from "./monsters";

/**
 * Grave Wockington's Skeleton waves, in human units. The sim converts it to
 * steps once. Placeholder numbers until his fight is designed (T446).
 */
export type GraveWockingtonTuning = {
  /** How long after he first goes after the Hero until his first wave (ms). */
  firstWaveMs: number;
  /** How long after a wave until the next (ms), counted while he is after the Hero. */
  waveEveryMs: number;
  /** How many Monsters one wave raises. */
  waveSize: number;
  /** How many Monsters he raised can be alive at once; a wave raises up to it. */
  raisedLimit: number;
  /** What he raises, at the Area's Monster Level. */
  raises: MonsterType;
  /** How far from him a Monster he raises stands (tiles). */
  raiseDistance: number;
  /**
   * The turn: his Life at or below this fraction of his maximum is past half.
   * His Gravefire recovery past it is in his type's attack.
   */
  halfAt: number;
  /** His waves past half his Life, in place of the numbers above. */
  pastHalf: {
    waveEveryMs: number;
    waveSize: number;
    raisedLimit: number;
    /** Skeleton Archers in each wave, among its `waveSize`. */
    archers: number;
  };
};

export const graveWockingtonTuning: GraveWockingtonTuning = {
  firstWaveMs: 2000,
  waveEveryMs: 10000,
  waveSize: 3,
  raisedLimit: 6,
  raises: "skeleton",
  raiseDistance: 1.6,
  halfAt: 0.5,
  pastHalf: { waveEveryMs: 7000, waveSize: 5, raisedLimit: 9, archers: 1 },
};
