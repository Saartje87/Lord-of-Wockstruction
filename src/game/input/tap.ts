import type { CursorPoint } from "../cursor";
import type { Vec } from "../sim/vec";
import { inputTuning } from "../tuning/input";

/**
 * A touch on the panels and the HUD, which acts only as it lifts: a tap
 * clicks where it came down, while a long press only shows the tooltip
 * there. UI state, for touch alone.
 */
export type TapInput = {
  /** The touch down now, where and on what, and since when (ms). */
  down: { point: CursorPoint; sinceMs: number } | null;
  /** Where the last touch on the panels came down, if any. */
  lastAt: Vec | null;
};

export function createTapInput(): TapInput {
  return { down: null, lastAt: null };
}

/** A touch came down at `point` on the panels or the HUD at `nowMs`. */
export function tapDown(input: TapInput, point: CursorPoint, nowMs: number) {
  input.down = { point, sinceMs: nowMs };
  input.lastAt = point.at;
}

/**
 * The touch lifted at `nowMs`: the click a tap gives where it came down,
 * or null after a long press, which lifts and presses nothing, or with no
 * touch down.
 */
export function tapUp(input: TapInput, nowMs: number): CursorPoint | null {
  const { down } = input;
  input.down = null;
  if (!down || isLong(down.sinceMs, nowMs)) return null;
  return down.point;
}

/** Forgets the touch down, as a pause does, so its lift clicks nothing. */
export function cancelTap(input: TapInput) {
  input.down = null;
}

/**
 * Where touch points at `nowMs`, for the tooltip and a Held Item or Held
 * Skill, with the finger at `screen` (null once lifted): a long press's
 * point, for its tooltip; while something is `holding`, the finger, or
 * where the last tap was once it lifts; and with nothing held, no tooltip
 * until a press is long, but the finger on the World for its hover.
 */
export function tapPointer(
  input: TapInput,
  nowMs: number,
  { holding, screen }: { holding: boolean; screen: Vec | null },
): Vec | null {
  const { down } = input;
  if (down && !holding && isLong(down.sinceMs, nowMs)) return down.point.at;
  if (holding) return screen ?? input.lastAt;
  return down ? null : screen;
}

/** Whether a touch down since `sinceMs` is a long press at `nowMs`. */
function isLong(sinceMs: number, nowMs: number): boolean {
  return nowMs - sinceMs >= inputTuning.longPressMs;
}
