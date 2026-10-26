/** Mouse input and its feedback, in human units. */
export type InputTuning = {
  /** While the button is held, how often the Hero re-targets the cursor (ms). */
  retargetMs: number;
  /** How long the click marker shows (ms). */
  clickMarkerMs: number;
};

export const inputTuning: InputTuning = {
  retargetMs: 120,
  clickMarkerMs: 400,
};
