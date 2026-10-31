import type { Rarity } from "./items";
import type { MonsterType } from "./monsters";

/**
 * Grave Wockington's own tuning beside his type's: his Life and his Skeleton
 * waves, in human units. The sim converts it to steps once. First tuning pass
 * (T513); his Life setting since T552.
 */
export type GraveWockingtonTuning = {
  /**
   * Times his type's max Life at the same Monster Level, in place of a
   * Unique Monster's (`uniqueTuning.life`).
   */
  life: number;
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
  /**
   * The Items his kill always drops, in turn, in place of a Unique Monster's
   * (`uniqueTuning.itemDrops`): each lists the Rarities it may roll. His
   * Potion drop is as usual.
   */
  itemDrops: readonly (readonly Rarity[])[];
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
  life: 4,
  itemDrops: [["rare"], ["rare"], ["magic", "rare"]],
  firstWaveMs: 2000,
  waveEveryMs: 8000,
  waveSize: 3,
  raisedLimit: 6,
  raises: "skeleton",
  raiseDistance: 1.6,
  halfAt: 0.5,
  pastHalf: { waveEveryMs: 6000, waveSize: 4, raisedLimit: 8, archers: 1 },
};
