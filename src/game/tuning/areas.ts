/** Area tuning, in human units. The sim converts it to steps once. */
export type AreaTuning = {
  /**
   * How long walking through an Exit takes (ms): the screen fades out and in
   * while the World stands still, and the Areas swap halfway.
   */
  changeMs: number;
  /** How long the Area Banner takes to fade in on arriving (ms). */
  bannerFadeInMs: number;
  /** How long it then holds fully opaque (ms). */
  bannerHoldMs: number;
  /** How long it then takes to fade out (ms). */
  bannerFadeOutMs: number;
};

export const areaTuning: AreaTuning = {
  changeMs: 300,
  bannerFadeInMs: 500,
  bannerHoldMs: 2000,
  bannerFadeOutMs: 1000,
};
