import type { Vec } from "../sim/vec";
import { tileToScreen, type WorldCamera } from "./camera";

/** How far a character's picking box reaches to each side of it, in tiles. */
const BOX_HALF_WIDTH = 0.35;

/** A character standing at `pos` (tile units), `height` tiles tall. */
export type Pickable3d<Id> = { id: Id; pos: Vec; height: number };

/**
 * The character whose box is under `point` (CSS px), the one in front,
 * lowest on screen, where boxes overlap; null over none. A character's box
 * is the box around its model, projected through the camera.
 */
export function characterUnder3d<Id>(
  camera: WorldCamera,
  characters: readonly Pickable3d<Id>[],
  point: Vec,
): Id | null {
  let front: { id: Id; feet: number } | null = null;
  for (const { id, pos, height } of characters) {
    const feet = tileToScreen(camera, pos).y;
    if (front && feet <= front.feet) continue;
    if (insideBox(camera, pos, height, point)) front = { id, feet };
  }
  return front?.id ?? null;
}

/** Whether `point` is inside the screen rectangle round a character's box. */
function insideBox(
  camera: WorldCamera,
  pos: Vec,
  height: number,
  point: Vec,
): boolean {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const dx of [-BOX_HALF_WIDTH, BOX_HALF_WIDTH]) {
    for (const dy of [-BOX_HALF_WIDTH, BOX_HALF_WIDTH]) {
      for (const lift of [0, height]) {
        const at = tileToScreen(camera, { x: pos.x + dx, y: pos.y + dy }, lift);
        left = Math.min(left, at.x);
        right = Math.max(right, at.x);
        top = Math.min(top, at.y);
        bottom = Math.max(bottom, at.y);
      }
    }
  }
  return (
    point.x >= left && point.x <= right && point.y >= top && point.y <= bottom
  );
}
