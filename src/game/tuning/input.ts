/** Mouse, controller and touch input and its feedback, in human units. */
export type InputTuning = {
  /** While the button is held, how often the Hero re-targets the cursor (ms). */
  retargetMs: number;
  /** How long the click marker shows (ms). */
  clickMarkerMs: number;
  /**
   * How far the stick must be pushed (0 at rest to 1 all the way) before it
   * walks the Hero, so a worn stick doesn't drift.
   */
  stickDeadZone: number;
};

export const inputTuning: InputTuning = {
  retargetMs: 120,
  clickMarkerMs: 400,
  stickDeadZone: 0.2,
};
