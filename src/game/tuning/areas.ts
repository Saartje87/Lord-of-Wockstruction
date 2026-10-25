/** Area tuning, in human units. The sim converts it to steps once. */
export type AreaTuning = {
  /**
   * How long walking through an Exit takes (ms): the screen fades out and in
   * while the World stands still, and the Areas swap halfway.
   */
  changeMs: number;
};

export const areaTuning: AreaTuning = {
  changeMs: 300,
};
