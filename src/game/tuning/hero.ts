/** Hero tuning, in human units. The sim converts it to steps once. */
export type HeroTuning = {
  /** Tiles per second. */
  walkSpeed: number;
  /** How far the Hero keeps from walls when cutting corners (tiles). */
  radius: number;
};

export const heroTuning: HeroTuning = {
  walkSpeed: 5.5,
  radius: 0.3,
};
