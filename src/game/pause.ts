/**
 * The pause menu's hold on time. The World has no pause of its own: the loop
 * runs on game time, which stands still while paused, so the clock owes no
 * steps for it on resuming.
 */
export type Pause = {
  paused: boolean;
  /** Real time spent paused before the current pause (ms). */
  pausedMs: number;
  /** When the current pause began (real ms), if paused. */
  sinceMs: number;
};

export function createPause(): Pause {
  return { paused: false, pausedMs: 0, sinceMs: 0 };
}

/** Pauses, or resumes, at real time `nowMs`. */
export function togglePause(pause: Pause, nowMs: number) {
  if (pause.paused) pause.pausedMs += nowMs - pause.sinceMs;
  else pause.sinceMs = nowMs;
  pause.paused = !pause.paused;
}

/** Real time `nowMs` as game time: real time less all the time paused. */
export function gameTime(pause: Pause, nowMs: number): number {
  const stoppedAt = pause.paused ? pause.sinceMs : nowMs;
  return stoppedAt - pause.pausedMs;
}
