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
};

export const graveWockingtonTuning: GraveWockingtonTuning = {
  firstWaveMs: 2000,
  waveEveryMs: 10000,
  waveSize: 3,
  raisedLimit: 6,
  raises: "skeleton",
  raiseDistance: 1.6,
};
