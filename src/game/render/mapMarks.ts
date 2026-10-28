import { toScreen } from "../iso";
import type { Area } from "../sim/area";
import type { Vec } from "../sim/vec";

/**
 * How the Map Overlay is drawn (CSS px, whatever the UI Scale): `scale` is
 * how much of the World's size a tile takes, and `opacity` how much of it
 * shows through. The marks' sizes are fixed pixels, never scaled with the map.
 */
export const MAP_OVERLAY = { scale: 0.25, opacity: 0.55 };

/** The look of the maps' lines and marks. */
export const MAP_LOOK = {
  /** Where walkable floor meets a wall. */
  wall: { colour: 0xd8d0b4, width: 2 },
  /** Where walkable floor meets void. */
  floor: { colour: 0x7d8a94, width: 1 },
  /** The Hero's white cross, `size` across. */
  hero: { colour: 0xffffff, size: 7, width: 1.5 },
};

/** One edge of a walkable tile, in tile units, with what is on its far side. */
export type MapEdge = { from: Vec; to: Vec; kind: "wall" | "floor" };

/**
 * What the maps draw, in tile units: shared by the Map Overlay and the Mini
 * Map, which only differ in where and how big they draw it.
 */
export type MapMarks = {
  /** The Area's wall and floor edges. */
  edges: MapEdge[];
  /** Where the Hero stands. */
  hero: Vec;
};

/**
 * The marks of `area` for a Hero standing at `heroAt`: a wall edge on each
 * side of a walkable tile that meets a wall, a floor edge on each that meets
 * void or the Area's end.
 */
export function mapMarks(of: { area: Area; heroAt: Vec }): MapMarks {
  const { area, heroAt } = of;
  const { width, height } = area;
  const at = (cells: boolean[], x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && cells[y * width + x];
  const edges: MapEdge[] = [];
  // Each side of a tile: its two corners, and the neighbour across it.
  const sides = [
    { from: [0, 0], to: [1, 0], across: [0, -1] },
    { from: [1, 0], to: [1, 1], across: [1, 0] },
    { from: [1, 1], to: [0, 1], across: [0, 1] },
    { from: [0, 1], to: [0, 0], across: [-1, 0] },
  ];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!at(area.walkable, x, y)) continue;
      for (const side of sides) {
        const [ax, ay] = [x + side.across[0], y + side.across[1]];
        if (at(area.walkable, ax, ay)) continue;
        edges.push({
          from: { x: x + side.from[0], y: y + side.from[1] },
          to: { x: x + side.to[0], y: y + side.to[1] },
          kind: at(area.floor, ax, ay) ? "wall" : "floor",
        });
      }
    }
  }
  return { edges, hero: { ...heroAt } };
}

/**
 * Where a point of the Area (tile units) lies from the centre of a map
 * centred on `heroAt`, in screen px: the World's isometric angle, at `scale`.
 */
export function mapOffset(tile: Vec, heroAt: Vec, scale: number): Vec {
  const at = toScreen({ x: tile.x - heroAt.x, y: tile.y - heroAt.y });
  return { x: at.x * scale, y: at.y * scale };
}
