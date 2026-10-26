import { type Area, type Exit, isWalkable, TOWN } from "./area";
import { canReach } from "./path";
import { tileOf } from "./vec";

/**
 * Checks that Areas fit together, throwing with a message naming the Area
 * and the problem: each needs a `start` Entry, each Combat Area an Area
 * Level and Town none, Exits must lead to an Entry
 * that exists and be reachable from `start`, and spawns must be on tiles the
 * Monsters can stand on.
 */
export function validateAreas(areas: Record<string, Area>) {
  for (const area of Object.values(areas)) {
    const start = area.entries.start;
    if (!start) throw new Error(`Area "${area.name}" has no "start" Entry`);

    if (area.name === TOWN && area.areaLevel !== null) {
      throw new Error(`Area "${area.name}" has an Area Level; Town has none`);
    }
    if (area.name !== TOWN && area.areaLevel === null) {
      throw new Error(
        `Area "${area.name}" is a Combat Area without an Area Level`,
      );
    }

    for (const spawn of area.spawns) {
      if (isWalkable(area, spawn.pos)) continue;
      const { x, y } = tileOf(spawn.pos);
      throw new Error(
        `Area "${area.name}" has a spawn on blocked tile (${x}, ${y})`,
      );
    }

    for (const exit of area.exits) {
      const target = areas[exit.area];
      if (!target) {
        throw new Error(
          `Area "${area.name}" has an Exit to unknown Area "${exit.area}"`,
        );
      }
      if (!target.entries[exit.entry]) {
        throw new Error(
          `Area "${area.name}" has an Exit to missing Entry "${exit.entry}" in Area "${exit.area}"`,
        );
      }
      if (!canReachExit(area, exit)) {
        throw new Error(
          `Area "${area.name}" has an Exit to "${exit.area}" that can't be reached from "start"`,
        );
      }
    }
  }
}

/** Whether any tile of an Exit's zone can be walked to from `start`. */
function canReachExit(area: Area, exit: Exit): boolean {
  const start = area.entries.start;
  for (let y = Math.floor(exit.y); y < exit.y + exit.height; y++) {
    for (let x = Math.floor(exit.x); x < exit.x + exit.width; x++) {
      const tile = { x: x + 0.5, y: y + 0.5 };
      if (isWalkable(area, tile) && canReach(area, start, tile)) return true;
    }
  }
  return false;
}
