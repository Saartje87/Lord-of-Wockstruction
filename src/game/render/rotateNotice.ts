import { viewportTuning } from "../tuning/viewport";
import type { RotateNotice } from "../viewport";

/**
 * What the Rotate Notice says, drawn over everything instead of the game:
 * to turn a screen held upright sideways, or to enlarge one too small.
 */
export function rotateNoticeText(notice: RotateNotice): {
  title: string;
  body: string;
} {
  if (notice === "turn") {
    return {
      title: "Turn your device",
      body: "Hold it sideways to play. The game waits, paused.",
    };
  }
  const { minPlayWidth, minPlayHeight } = viewportTuning;
  return {
    title: "Enlarge the window",
    body: `The game needs at least ${minPlayWidth}×${minPlayHeight} to play. It waits, paused.`,
  };
}
