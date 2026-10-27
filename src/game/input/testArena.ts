import { combatArea } from "../sim/testAreas";
import type { Vec } from "../sim/vec";
import { createWorld, type World } from "../sim/world";

/** A `monsterSpawn` object of one Skeleton at a point in tile units. */
function spawn(x: number, y: number) {
  return {
    name: "",
    type: "monsterSpawn",
    point: true,
    x: x * 32,
    y: y * 32,
    properties: [
      { name: "monster", type: "string", value: "skeleton" },
      { name: "count", type: "int", value: 1 },
    ],
  };
}

/**
 * A 20×20 Area of open floor with the Hero starting at (10, 10) and a
 * Skeleton at each of `at`. The Hero stands in Town unless `combat`, then in
 * a Combat Area of the same floor.
 */
export function arenaWith(at: Vec[], { combat = false } = {}): World {
  const area = {
    orientation: "orthogonal",
    width: 20,
    height: 20,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 20,
        height: 20,
        data: new Array(400).fill(1),
      },
      {
        type: "objectgroup",
        name: "objects",
        objects: [
          { name: "start", type: "entry", point: true, x: 320, y: 320 },
          ...at.map(({ x, y }) => spawn(x, y)),
        ],
      },
    ],
  };
  const areas = combat
    ? { town: area, arena: combatArea(area) }
    : { town: area };
  const world = createWorld({ areas, seed: 1 });
  // Set down in the Combat Area as if just arrived, so Skills can be cast.
  if (combat) world.areaName = "arena";
  // Spawns scatter around their point; put each exactly where asked.
  world.monsters.forEach((monster, i) => {
    monster.pos = { ...at[i] };
  });
  return world;
}
