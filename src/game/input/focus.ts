import type { CursorHit, CursorPoint } from "../cursor";
import { middleOf, type Rect } from "../sim/rect";

/** A way the Focus moves: the D-pad's directions, or the stick pushed one. */
export type FocusDirection = "up" | "down" | "left" | "right";

/** Anything the Focus can rest on in an open panel: a cell, slot or button. */
export type Focusable = { rect: Rect };

/**
 * A spot in an open panel the Focus can rest on, where it is drawn, and the
 * point and hit a click on it gives, which pressing it gives instead; and
 * where the second face button does more there than a right-click, as on a
 * learned Skill it picks up, the hit it clicks instead.
 */
export type FocusSpot = Focusable & CursorPoint & { secondHit?: CursorHit };

/**
 * The spot of `spots`, laid out afresh, that the Focus rests on after
 * resting on `last`: of those with its hit, else of all (its own gone, as a
 * button no longer shown), the nearest to it, middle to middle; the first
 * with no `last`, and null with no spots.
 */
export function refocus<Spot extends FocusSpot>(
  spots: readonly Spot[],
  last: FocusSpot | null,
): Spot | null {
  if (!last) return spots[0] ?? null;
  const hit = JSON.stringify(last.hit);
  const same = spots.filter((spot) => JSON.stringify(spot.hit) === hit);
  let best: { spot: Spot; distance: number } | null = null;
  for (const spot of same.length > 0 ? same : spots) {
    const distance = Math.hypot(
      middleOf(spot.rect).x - middleOf(last.rect).x,
      middleOf(spot.rect).y - middleOf(last.rect).y,
    );
    if (best === null || distance < best.distance) best = { spot, distance };
  }
  return best?.spot ?? null;
}

/** How much farther a step aside counts than one straight on. */
const ASIDE_WEIGHT = 2;

/**
 * The spot of `spots` the Focus moves to from `from` going `direction`: of
 * those whose middle lies past `from`'s edge that way, the nearest, middle
 * to middle, a step aside counting `ASIDE_WEIGHT` times one straight on.
 * `from` itself with none that way.
 */
export function moveFocus<Spot extends Focusable>(
  spots: readonly Spot[],
  from: Spot,
  direction: FocusDirection,
): Spot {
  const across = direction === "left" || direction === "right" ? "x" : "y";
  const aside = across === "x" ? "y" : "x";
  const sign = direction === "right" || direction === "down" ? 1 : -1;
  let best: { spot: Spot; score: number } | null = null;
  for (const spot of spots) {
    const along =
      sign * (middleOf(spot.rect)[across] - middleOf(from.rect)[across]);
    if (along <= half(from.rect, across)) continue;
    const offset = middleOf(spot.rect)[aside] - middleOf(from.rect)[aside];
    const score = along + ASIDE_WEIGHT * Math.abs(offset);
    if (best === null || score < best.score) best = { spot, score };
  }
  return best?.spot ?? from;
}

/** Half of `rect`'s size along `axis`. */
function half(rect: Rect, axis: "x" | "y"): number {
  return (axis === "x" ? rect.w : rect.h) / 2;
}
