import type { Vec } from "./sim/vec";

/** Screen size of one floor diamond, in CSS pixels. */
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

/** Projects tile units to screen pixels; tile (0, 0) is the top corner. */
export function toScreen(tile: Vec): Vec {
  return {
    x: ((tile.x - tile.y) * TILE_WIDTH) / 2,
    y: ((tile.x + tile.y) * TILE_HEIGHT) / 2,
  };
}

/** The inverse of `toScreen`. */
export function toTile(screen: Vec): Vec {
  const u = screen.x / (TILE_WIDTH / 2);
  const v = screen.y / (TILE_HEIGHT / 2);
  return { x: (v + u) / 2, y: (v - u) / 2 };
}
