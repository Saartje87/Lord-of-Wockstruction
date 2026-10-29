// Torch placement data: which Walls of an Area carry a torch, and where. No
// drawing; torchMeshes.ts draws them from the view.

import type { Area } from "../sim/area";
import type { Vec } from "../sim/vec";
import { hash } from "./floor";
import { wallPlacementsOf } from "./walls";

/** A torch mounted on a Wall. */
export type Torch = {
  /** Index into the Area's `walls`: the Wall it hangs on. */
  wall: number;
  /** Where it hangs, in tile units: out on the floor side of the Wall. */
  pos: Vec;
  /** Quarter turns about the vertical axis, as `WallPlacement.turn`. */
  turn: number;
};

/** How far out of the Wall's middle a torch hangs, in tiles. */
export const TORCH_OFFSET = 0.3;

/** The share of Walls that get a torch, before spacing. */
const SHARE = 0.3;

/** No two torches hang closer than this, in tiles. */
const SPACING = 3;

/**
 * The torches of an Area: on straight dungeon Walls that face the camera,
 * which looks from tile +x +y, so with floor on their +y or +x side. Chosen
 * by cell, so an Area always has the same ones. Areas don't list them.
 */
export function torchesOf(area: Area): Torch[] {
  const torches: Torch[] = [];
  const isFloor = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < area.width && y < area.height
      ? area.floor[y * area.width + x]
      : false;
  for (const { wall: at, piece } of wallPlacementsOf(area.walls)) {
    if (piece !== "dungeon/wall") continue;
    const { x, y } = area.walls[at];
    if (hash(x, y, 4) >= SHARE) continue;
    const south = isFloor(x, y + 1);
    const east = isFloor(x + 1, y);
    if (!south && !east) continue;
    const pos = south
      ? { x: x + 0.5, y: y + 0.5 + TORCH_OFFSET }
      : { x: x + 0.5 + TORCH_OFFSET, y: y + 0.5 };
    if (
      torches.some(
        (t) => Math.hypot(t.pos.x - pos.x, t.pos.y - pos.y) < SPACING,
      )
    ) {
      continue;
    }
    torches.push({ wall: at, pos, turn: south ? 0 : 1 });
  }
  return torches;
}
