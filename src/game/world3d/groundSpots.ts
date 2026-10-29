import type { ItemId } from "../sim/inventory";
import type { Vec } from "../sim/vec";
import { tileToScreen, type WorldCamera } from "./camera";
import type { GroundItemView } from "./view";

/** How high above the floor a Ground Item's spot is, in tiles. */
const SPOT_HEIGHT = 0.25;

/** Where a Ground Item is on the screen (CSS px), the point its label hangs from. */
export type GroundSpot = { id: ItemId; at: Vec };

/**
 * Where each Ground Item's model is on the screen through `camera`: on the
 * model rather than the floor under it, so labels sit over the Items.
 */
export function groundSpotsOf(
  camera: WorldCamera,
  items: readonly GroundItemView[],
): GroundSpot[] {
  return items.map(({ id, pos }) => ({
    id,
    at: tileToScreen(camera, pos, SPOT_HEIGHT),
  }));
}
