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
  /**
   * How wide the cone ahead of the Hero is that auto-aim picks the Target
   * in, from one edge to the other (degrees).
   */
  targetConeDegrees: number;
  /** How far ahead of the Hero auto-aim picks the Target (tiles). */
  targetRange: number;
  /**
   * How near the Hero a Ground Item must lie for A, with no Target, to pick
   * it up (tiles).
   */
  groundItemReach: number;
  /**
   * How far ahead of the Hero a controller casts a Skill when there is no
   * Target (tiles).
   */
  castDistance: number;
};

export const inputTuning: InputTuning = {
  retargetMs: 120,
  clickMarkerMs: 400,
  stickDeadZone: 0.2,
  targetConeDegrees: 90,
  targetRange: 6,
  groundItemReach: 1.5,
  castDistance: 3,
};
