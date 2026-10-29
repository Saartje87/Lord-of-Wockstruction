import type { AnimationAction } from "three";

/** How long one clip takes to give way to the next, seconds. */
const BLEND_SECONDS = 0.12;

/**
 * The model's turn after `dt` seconds of easing from `turn` towards the tile
 * space `facing`, the short way round. KayKit's models look down +z; facing is
 * atan2 in tile space (x, z). A null `turn` (first pose) snaps to the target.
 * `rate` is how fast it eases, per second.
 */
export function turnTowards(
  turn: number | null,
  facing: number,
  dt: number,
  rate: number,
): number {
  const target = Math.PI / 2 - facing;
  if (turn === null) return target;
  const gap = Math.atan2(Math.sin(target - turn), Math.cos(target - turn));
  return turn + gap * Math.min(1, dt * rate);
}

/**
 * Moves each action's weight a step towards 1 for `name` and 0 for the rest.
 * The first pose has nothing to blend from, so it jumps.
 */
export function blendClips(
  actions: Map<string, AnimationAction>,
  name: string | undefined,
  dt: number,
  first: boolean,
) {
  const blend = first ? 1 : Math.min(1, dt / BLEND_SECONDS);
  for (const [clipName, action] of actions) {
    const goal = clipName === name ? 1 : 0;
    action.weight += Math.sign(goal - action.weight) * blend;
    action.weight = Math.min(1, Math.max(0, action.weight));
  }
}

/**
 * The time to scrub a clip to: a one-shot's `progress` (held just short of the
 * end, where a repeating clip would wrap round) or a looping clip's `seconds`.
 */
export function scrubTime(
  animation: { progress: number } | { seconds: number },
  duration: number,
  phase = 0,
): number {
  return "progress" in animation
    ? Math.min(duration - 1e-3, animation.progress * duration)
    : (animation.seconds + phase) % duration;
}
