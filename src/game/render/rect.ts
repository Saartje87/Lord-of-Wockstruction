import type { Vec } from "../sim/vec";

/** An axis-aligned box on the screen (CSS px). */
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
