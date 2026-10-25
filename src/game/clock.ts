import { STEPS_PER_SECOND } from "./sim/units";

/** Longer frames (a hitch, a backgrounded tab) are cut to this. */
const MAX_FRAME_MS = 250;

export type Clock = {
  /** Time not yet stepped, counted in steps rather than ms so it stays exact. */
  stepsOwed: number;
};

export function createClock(): Clock {
  return { stepsOwed: 0 };
}

/**
 * Feeds one frame's elapsed time to the clock. Returns how many steps to run
 * now, and how far (0..1) the frame is between the last step and the next,
 * for the renderer to interpolate with.
 */
export function advance(
  clock: Clock,
  frameMs: number,
): { steps: number; alpha: number } {
  // The first rAF timestamp can be slightly earlier than the time we started.
  const ms = Math.min(Math.max(frameMs, 0), MAX_FRAME_MS);
  clock.stepsOwed += (ms * STEPS_PER_SECOND) / 1000;
  const steps = Math.floor(clock.stepsOwed);
  clock.stepsOwed -= steps;
  return { steps, alpha: clock.stepsOwed };
}
