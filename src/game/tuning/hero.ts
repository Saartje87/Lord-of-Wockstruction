/** Hero tuning, in human units. The sim converts it to steps once. */
export type HeroTuning = {
  /** Tiles per second. */
  walkSpeed: number;
  /** How far the Hero keeps from walls when cutting corners (tiles). */
  radius: number;
  /** How long one swing takes (ms). */
  swingMs: number;
  /** How far into a swing its hit lands, as a fraction of `swingMs`. */
  hitAt: number;
  /** How near a Monster must be to swing at it (tiles, centre to centre). */
  reach: number;
  /**
   * How much further a Monster an `Attack` swings at may get before the hit
   * lands, and still be hit (tiles).
   */
  reachGrace: number;
  /** A `SwingAt` hits every Monster in reach within this of the facing. */
  arcDegrees: number;
  /** Damage per hit, rolled from `[min, max]` inclusive. */
  damage: [number, number];
  /** How long the whole simulation pauses when a swing lands a hit (ms). */
  hitstopMs: number;
};

export const heroTuning: HeroTuning = {
  walkSpeed: 5.5,
  radius: 0.3,
  swingMs: 350,
  hitAt: 0.4,
  reach: 1.0,
  reachGrace: 0.3,
  arcDegrees: 50,
  damage: [20, 30],
  hitstopMs: 60,
};
