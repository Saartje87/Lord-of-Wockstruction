import { angleBetween, distance, type Vec } from "./vec";

/** Anything that stands somewhere facing some way: the Hero, a Monster, a Minion. */
type Facer = { pos: Vec; facing: number };

/** Turns `facer` towards `at`, keeping its facing when standing right on it. */
export function faceToward(facer: Facer, at: Vec) {
  const dx = at.x - facer.pos.x;
  const dy = at.y - facer.pos.y;
  if (dx !== 0 || dy !== 0) facer.facing = Math.atan2(dy, dx);
}

/**
 * Whether an attack by `attacker`, in the facing it wound up in, lands on a
 * target at `at`: one within `reach` and within `arc` radians of that facing,
 * or standing right on it.
 */
export function lands(
  attacker: Facer,
  at: Vec,
  reach: number,
  arc: number,
): boolean {
  const gap = distance(attacker.pos, at);
  if (gap > reach) return false;
  if (gap === 0) return true;
  const angle = Math.atan2(at.y - attacker.pos.y, at.x - attacker.pos.x);
  return angleBetween(angle, attacker.facing) <= arc;
}
