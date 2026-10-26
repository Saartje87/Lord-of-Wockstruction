/** Mouse input and its feedback, in human units. */
export type InputTuning = {
  /** While the button is held, how often the Hero re-targets the cursor (ms). */
  retargetMs: number;
  /** How long the click marker shows (ms). */
  clickMarkerMs: number;
  /**
   * How far the pointer must move from where the button went down before
   * letting go counts as a drag rather than a click (CSS px), so a wobbly
   * click stays a click.
   */
  dragThresholdPx: number;
};

export const inputTuning: InputTuning = {
  retargetMs: 120,
  clickMarkerMs: 400,
  dragThresholdPx: 6,
};
