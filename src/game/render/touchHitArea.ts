import { overlaps, type Rect } from "../sim/rect";

/**
 * How big a touch hit area grows, in each direction where there's room
 * (CSS px on the screen, not scaled by the UI Scale): about a fingertip.
 */
export const TOUCH_HIT_AREA = 44;

/** `rect` grown about its middle to at least `TOUCH_HIT_AREA` each way. */
function grown(rect: Rect): Rect {
  const growX = Math.max(0, (TOUCH_HIT_AREA - rect.w) / 2);
  const growY = Math.max(0, (TOUCH_HIT_AREA - rect.h) / 2);
  return {
    x: rect.x - growX,
    y: rect.y - growY,
    w: rect.w + 2 * growX,
    h: rect.h + 2 * growY,
  };
}

/**
 * How far apart `a` and `b` are along each axis: the gap between them, or
 * less than zero where they're side by side along it.
 */
function gaps(a: Rect, b: Rect): { x: number; y: number } {
  return {
    x: Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)),
    y: Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)),
  };
}

/**
 * `area` stopped halfway between `drawn` and `neighbour`, across the axis
 * they're furthest apart along: the same line from either side, so two
 * targets' hit areas meet there and never overlap.
 */
function stoppedHalfway(area: Rect, drawn: Rect, neighbour: Rect): Rect {
  const gap = gaps(drawn, neighbour);
  let { x, y } = area;
  let right = area.x + area.w;
  let bottom = area.y + area.h;
  if (gap.x >= gap.y) {
    if (neighbour.x >= drawn.x + drawn.w) {
      right = Math.min(right, drawn.x + drawn.w + gap.x / 2);
    } else {
      x = Math.max(x, drawn.x - gap.x / 2);
    }
  } else if (neighbour.y >= drawn.y + drawn.h) {
    bottom = Math.min(bottom, drawn.y + drawn.h + gap.y / 2);
  } else {
    y = Math.max(y, drawn.y - gap.y / 2);
  }
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * Where a touch hits a target drawn at `drawn`: its drawn rect grown toward
 * `TOUCH_HIT_AREA` square, but on each side stopping halfway to whichever
 * of the targets drawn at `neighbours` it would reach (the halfway rule).
 * So no two hit areas overlap, a touch between two targets goes to the
 * nearer, and each target's drawn rect stays its own. A neighbour drawn
 * over `drawn`, like a Skill's rows round its +, doesn't stop it.
 */
export function touchHitRect(drawn: Rect, neighbours: readonly Rect[]): Rect {
  const reach = grown(drawn);
  let area = reach;
  for (const neighbour of neighbours) {
    if (overlaps(drawn, neighbour)) continue;
    // Only where the two could reach each other's, as from either side.
    if (!overlaps(reach, grown(neighbour))) continue;
    area = stoppedHalfway(area, drawn, neighbour);
  }
  return area;
}
