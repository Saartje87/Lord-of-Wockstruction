/** The 8 directions a character sprite faces, as compass points on screen. */
export type Compass = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

// Every 45° from tile +x, which is down-right on screen.
const BY_TILE_ANGLE: Compass[] = ["se", "s", "sw", "w", "nw", "n", "ne", "e"];

/**
 * The sprite direction for an exact facing (radians in tile space). Flare's
 * 8 directions are 45° apart in tile space, not on screen, so it snaps there.
 */
export function compassOf(facing: number): Compass {
  const eighth = Math.round(facing / (Math.PI / 4));
  return BY_TILE_ANGLE[((eighth % 8) + 8) % 8];
}

/** How an animation plays: its length and frame time, and whether it loops. */
export type Timing = { frames: number; frameMs: number; loop: boolean };

/**
 * The frame of an animation `ms` after it started: a looped one wraps, one
 * that plays once holds its last frame.
 */
export function frameAt(timing: Timing, ms: number): number {
  const frame = Math.floor(ms / timing.frameMs);
  return timing.loop
    ? frame % timing.frames
    : Math.min(frame, timing.frames - 1);
}

/**
 * The frame of a swing `ms` after it started, timed so that the strike frame
 * starts exactly when the hit lands: the frames before it share the time up
 * to the hit, and the rest share the time after it.
 */
export function swingFrame(
  swing: {
    frames: number;
    strikeFrame: number;
    swingMs: number;
    hitMs: number;
  },
  ms: number,
): number {
  const { frames, strikeFrame, swingMs, hitMs } = swing;
  if (ms < hitMs) return Math.floor((ms / hitMs) * strikeFrame);
  const after = (ms - hitMs) / (swingMs - hitMs);
  return Math.min(
    frames - 1,
    strikeFrame + Math.floor(after * (frames - strikeFrame)),
  );
}
