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
  /** Whether the menu is asking to confirm a New Hero. */
  confirming: boolean;
};

export function createPause(): Pause {
  return { paused: false, pausedMs: 0, sinceMs: 0, confirming: false };
}

/** Pauses, or resumes, at real time `nowMs`. */
export function togglePause(pause: Pause, nowMs: number) {
  if (pause.paused) pause.pausedMs += nowMs - pause.sinceMs;
  else pause.sinceMs = nowMs;
  pause.paused = !pause.paused;
  pause.confirming = false;
}

/**
 * A key pressed at real time `nowMs`, by `KeyboardEvent.key`. Esc opens and
 * closes the menu; in the menu, N asks to confirm a New Hero, and then Y
 * confirms it, resuming, while N or Esc goes back to the menu. Returns
 * `"newHero"` once confirmed, for the caller to start one.
 */
export function pressKey(
  pause: Pause,
  key: string,
  nowMs: number,
): "newHero" | null {
  const letter = key.toLowerCase();
  if (pause.confirming) {
    if (letter === "y") {
      togglePause(pause, nowMs);
      return "newHero";
    }
    if (letter === "n" || key === "Escape") pause.confirming = false;
    return null;
  }
  if (key === "Escape") togglePause(pause, nowMs);
  else if (pause.paused && letter === "n") pause.confirming = true;
  return null;
}

/** Real time `nowMs` as game time: real time less all the time paused. */
export function gameTime(pause: Pause, nowMs: number): number {
  const stoppedAt = pause.paused ? pause.sinceMs : nowMs;
  return stoppedAt - pause.pausedMs;
}
