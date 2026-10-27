import type { CursorPoint } from "../cursor";
import type { Rect } from "../sim/rect";

/** A way the Focus moves: the D-pad's directions, or the stick pushed one. */
export type FocusDirection = "up" | "down" | "left" | "right";

/** Anything the Focus can rest on in an open panel: a cell, slot or button. */
export type Focusable = { rect: Rect };

/**
 * A spot in an open panel the Focus can rest on, where it is drawn, and the
 * point and hit a click on it gives, which pressing it gives instead.
 */
export type FocusSpot = Focusable & CursorPoint;

/** Whether `a` and `b` are the same spot, though laid out afresh. */
export function sameSpot(a: CursorPoint, b: CursorPoint): boolean {
  return JSON.stringify(a.hit) === JSON.stringify(b.hit);
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
      sign * (middle(spot.rect, across) - middle(from.rect, across));
    if (along <= half(from.rect, across)) continue;
    const offset = middle(spot.rect, aside) - middle(from.rect, aside);
    const score = along + ASIDE_WEIGHT * Math.abs(offset);
    if (best === null || score < best.score) best = { spot, score };
  }
  return best?.spot ?? from;
}

/** The middle of `rect` along `axis`. */
function middle(rect: Rect, axis: "x" | "y"): number {
  return rect[axis] + half(rect, axis);
}

/** Half of `rect`'s size along `axis`. */
function half(rect: Rect, axis: "x" | "y"): number {
  return (axis === "x" ? rect.w : rect.h) / 2;
}
