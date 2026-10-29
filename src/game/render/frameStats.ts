/** How often the stats panel gets a new reading. */
const READING_MS = 500;

/** What the last frame drew: three.js's draw calls and triangles. */
export type Drawn = { calls: number; triangles: number };

/** What the stats panel shows. */
export type FrameStatsReading = {
  fps: number;
  frameMs: number;
  drawn: Drawn;
};

/** The frames counted since the last reading. */
export type FrameStats = { since: number; frames: number };

/** Starts counting frames at real time `nowMs`. */
export function createFrameStats(nowMs: number): FrameStats {
  return { since: nowMs, frames: 0 };
}

/**
 * Counts a frame drawn at real time `nowMs`, and every half second returns
 * a reading averaged over the frames since the last one; null in between.
 */
export function recordFrame(
  stats: FrameStats,
  nowMs: number,
  drawn: Drawn,
): FrameStatsReading | null {
  stats.frames++;
  const elapsed = nowMs - stats.since;
  if (elapsed < READING_MS) return null;
  const reading = {
    fps: (stats.frames * 1000) / elapsed,
    frameMs: elapsed / stats.frames,
    drawn,
  };
  stats.since = nowMs;
  stats.frames = 0;
  return reading;
}
