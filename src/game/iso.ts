import type { Vec } from "./sim/vec";

/**
 * Screen size of one floor diamond at World zoom 1, in CSS pixels. The 3D
 * World's camera looks along the same 2:1 diamonds, and the Mini Map and Map
 * Overlay draw with them, so all three share one angle.
 */
export const TILE_WIDTH = 192;
export const TILE_HEIGHT = 96;

/** Projects tile units to screen pixels; tile (0, 0) is the top corner. */
export function toScreen(tile: Vec): Vec {
  return {
    x: ((tile.x - tile.y) * TILE_WIDTH) / 2,
    y: ((tile.x + tile.y) * TILE_HEIGHT) / 2,
  };
}
