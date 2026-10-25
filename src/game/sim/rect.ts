import type { Vec } from "./vec";

/**
 * An axis-aligned box: on the screen in CSS px, or in the Inventory in
 * cells.
 */
export type Rect = { x: number; y: number; w: number; h: number };

/** Whether `point` is in `rect`, edges included. */
export function inside(rect: Rect, point: Vec): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

/** Whether two boxes share some area: touching edges don't count. */
export function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}
