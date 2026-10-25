import { describe, expect, it } from "vitest";
import { areas, tilesets } from "./content";
import type { Area, Exit } from "./sim/area";
import { createWorld, type SimEvent, step, type World } from "./sim/world";

// Building the World runs the loader's validation: a `start` Entry, Exits to
// an Entry that exists and can be reached from `start`, and spawns on tiles
// Monsters can stand on.
const shippedWorld = () => createWorld({ areas, tilesets, seed: 1 });

/** The Combat Area that Town's one Exit leads to. */
const combatAreaOf = (world: World) =>
  world.areas[world.areas.town.exits[0].area];

/** An Area's Exit back to Town; throws when it has none. */
function exitToTown(area: Area): Exit {
  const exit = area.exits.find((exit) => exit.area === "town");
  if (!exit) throw new Error(`Area "${area.name}" has no Exit to Town`);
  return exit;
}

/** The centre of an Exit's zone. */
const centreOf = (exit: Exit) => ({
  x: exit.x + exit.width / 2,
  y: exit.y + exit.height / 2,
});

/** Expects `value` to be `about` give or take `slack`. */
function expectAbout(value: number, about: number, slack: number) {
  expect(value).toBeGreaterThanOrEqual(about - slack);
  expect(value).toBeLessThanOrEqual(about + slack);
}

/**
 * Walks the Hero into an Exit, stepping until they have arrived in another
 * Area and the fade is over, or `maxSteps` pass. Returns the `AreaChanged`
 * event, if any.
 */
function walkThrough(world: World, exit: Exit, maxSteps = 60 * 60) {
  let changed: Extract<SimEvent, { type: "AreaChanged" }> | null = null;
  step(world, [{ type: "MoveTo", target: centreOf(exit) }]);
  for (let i = 0; i < maxSteps && !(changed && !world.areaChange); i++) {
    for (const event of step(world, [])) {
      if (event.type === "AreaChanged") changed = event;
    }
  }
  return changed;
}

describe("the shipped Areas", () => {
  it("build a World that passes validation", () => {
    const world = shippedWorld();

    expect(Object.keys(world.areas).sort()).toEqual(Object.keys(areas).sort());
  });

  it("start the Hero at `start` in a Town of about 32×32 on the grassland tileset, with NPCs and no Monsters", () => {
    const world = shippedWorld();
    const town = world.areas.town;

    expect(world.areaName).toBe("town");
    expect(world.hero.pos).toEqual({ x: 15.5, y: 16.5 });
    expect(town.tileset).toBe("grassland");
    expectAbout(town.width, 32, 4);
    expectAbout(town.height, 32, 4);
    expect(town.npcs.length).toBeGreaterThan(0);
    expect(town.spawns).toEqual([]);
    expect(world.monsters).toEqual([]);
  });

  it("block Town's cliffs and trees by their tileset, and not its plants", () => {
    const town = shippedWorld().areas.town;
    const at = (x: number, y: number) => y * town.width + x;

    // A cliff on the west edge, and a tree.
    expect(town.propTiles[at(1, 9)]).toBe(48);
    expect(town.walkable[at(1, 9)]).toBe(false);
    expect(town.propTiles[at(4, 9)]).toBe(254);
    expect(town.walkable[at(4, 9)]).toBe(false);
    // A fern.
    expect(town.propTiles[at(7, 3)]).toBe(112);
    expect(town.walkable[at(7, 3)]).toBe(true);
  });

  it("lead from Town through one Exit to a Combat Area of about 64×64 on the dungeon tileset", () => {
    const world = shippedWorld();
    const combat = combatAreaOf(world);

    expect(world.areas.town.exits).toHaveLength(1);
    expect(combat.tileset).toBe("dungeon");
    expectAbout(combat.width, 64, 8);
    expectAbout(combat.height, 64, 8);
  });

  it("fill the Combat Area with 3–4 Skeleton groups, one about 7 strong", () => {
    const combat = combatAreaOf(shippedWorld());
    const counts = combat.spawns.map((spawn) => spawn.count);

    expect(combat.spawns.every((s) => s.monster === "skeleton")).toBe(true);
    expectAbout(counts.length, 3.5, 0.5);
    expect(counts.some((count) => Math.abs(count - 7) <= 1)).toBe(true);
  });

  it("put the Combat Area's Exit back to Town at its start", () => {
    const world = shippedWorld();
    const combat = combatAreaOf(world);
    const entry = combat.entries[world.areas.town.exits[0].entry];
    const centre = centreOf(exitToTown(combat));

    expect(Math.hypot(centre.x - entry.x, centre.y - entry.y)).toBeLessThan(4);
  });

  it("let the Hero walk from Town to the Combat Area and back", () => {
    const world = shippedWorld();
    const combat = combatAreaOf(world);
    const arrivedThere = walkThrough(world, world.areas.town.exits[0]);

    expect(arrivedThere?.area).toBe(combat.name);
    const arrivedHome = walkThrough(world, exitToTown(combat));

    expect(arrivedHome?.area).toBe("town");
    expect(world.areaName).toBe("town");
  });
});
