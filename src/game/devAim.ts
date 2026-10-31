import { tileCentre } from "./input/pointer";
import type { Vec } from "./sim/vec";
import type { Order } from "./sim/world";
import { tileToScreen, type WorldCamera } from "./world3d/camera";

/**
 * Where a tile position is drawn on the canvas through `camera` (CSS px, the
 * space of a pointer event's offsetX and offsetY), lifted `height` tiles, or
 * null when that falls outside the canvas. Dev builds only: see `GameCanvas`.
 */
export function screenOf(
  camera: WorldCamera,
  pos: Vec,
  height = 0,
): Vec | null {
  const at = tileToScreen(camera, pos, height);
  const inside =
    at.x >= 0 && at.x < camera.width && at.y >= 0 && at.y < camera.height;
  return inside ? at : null;
}

/**
 * The orders a click on the floor at `pos` gives: a walk to the centre of
 * its tile, along the Hero's own path. Nothing while paused, as a click then
 * only works the menu, nor in the Hero's Death, where a click only goes on.
 * Never an attack, a talk or a pick-up, whatever stands there. Dev builds
 * only: see `GameCanvas`.
 */
export function walkToOrders(
  pos: Vec,
  { paused, heroDead }: { paused: boolean; heroDead: boolean },
): Order[] {
  if (paused || heroDead) return [];
  return [{ type: "MoveTo", target: tileCentre(pos) }];
}
