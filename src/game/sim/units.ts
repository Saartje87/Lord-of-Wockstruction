/**
 * The simulation advances in fixed steps at this rate. Tuning is authored in
 * human units (ms, tiles/s) and converted to steps once, with these.
 */
export const STEPS_PER_SECOND = 60;
export const STEP_MS = 1000 / STEPS_PER_SECOND;

/** A duration in ms as whole steps, rounded to the nearest step. */
export function msToSteps(ms: number): number {
  return Math.round((ms * STEPS_PER_SECOND) / 1000);
}

/** A rate per second (tiles/s, …) as a rate per step. */
export function perStep(perSecond: number): number {
  return perSecond / STEPS_PER_SECOND;
}
