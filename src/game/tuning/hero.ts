/** Hero tuning, in human units. The sim converts it to steps once. */
export type HeroTuning = {
  /** Tiles per second. */
  walkSpeed: number;
};

export const heroTuning: HeroTuning = {
  walkSpeed: 5.5,
};
