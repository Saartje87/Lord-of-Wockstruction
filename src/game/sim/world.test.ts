import { describe, expect, it } from "vitest";
import { combatArea } from "./testAreas";
import type { Vec } from "./vec";
import { createWorld, type Order, step, type World } from "./world";

// A 3×2 orthogonal Area with 32 px tiles and a `start` Entry in the middle
// of tile (1, 1).
function tmj(objects: object[]) {
  return {
    orientation: "orthogonal",
    width: 3,
    height: 2,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 3,
        height: 2,
        data: [1, 1, 1, 1, 1, 0],
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

const start = { name: "start", type: "entry", point: true, x: 48, y: 48 };

/** An Exit covering tile (x, y), to an Entry in another Area. */
function exit(x: number, y: number, area: string, entry: string) {
  return {
    name: "",
    type: "exit",
    x: x * 32,
    y: y * 32,
    width: 32,
    height: 32,
    properties: [
      { name: "area", type: "string", value: area },
      { name: "entry", type: "string", value: entry },
    ],
  };
}

describe("createWorld", () => {
  it("puts the Hero in Town at the `start` Entry", () => {
    const world = createWorld({ areas: { town: tmj([start]) }, seed: 1 });

    expect(world.areaName).toBe("town");
    expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });
  });

  it("puts the Hero at the `start` option's Entry, with its Monsters", () => {
    const fromTown = { ...start, name: "from-town", x: 16, y: 16 };
    const skeleton = {
      name: "",
      type: "monsterSpawn",
      point: true,
      x: 48,
      y: 16,
      properties: [{ name: "monster", type: "string", value: "skeleton" }],
    };
    const cave = combatArea(tmj([start, fromTown, skeleton]));

    const world = createWorld({
      areas: { town: tmj([start]), cave },
      seed: 1,
      start: { area: "cave", entry: "from-town" },
    });

    expect(world.areaName).toBe("cave");
    expect(world.hero.pos).toEqual({ x: 0.5, y: 0.5 });
    expect(world.monsters).toHaveLength(1);
  });

  it("puts the Hero in Town when the `start` option's Area or Entry is unknown", () => {
    const areas = { town: tmj([start]), cave: combatArea(tmj([start])) };

    for (const unknown of [
      { area: "swamp", entry: "start" },
      { area: "cave", entry: "from-swamp" },
    ]) {
      const world = createWorld({ areas, seed: 1, start: unknown });

      expect(world.areaName).toBe("town");
      expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });
    }
  });

  it("throws naming the Area when it has no `start` Entry", () => {
    const elsewhere = { ...start, name: "from-cave" };

    expect(() =>
      createWorld({ areas: { town: tmj([elsewhere]) }, seed: 1 }),
    ).toThrow('Area "town" has no "start" Entry');
  });

  it("throws naming any Area with no `start` Entry", () => {
    expect(() =>
      createWorld({ areas: { town: tmj([start]), cave: tmj([]) }, seed: 1 }),
    ).toThrow('Area "cave" has no "start" Entry');
  });

  it("throws naming the Area when an Exit leads to an unknown Area", () => {
    const town = tmj([start, exit(0, 0, "cave", "start")]);

    expect(() => createWorld({ areas: { town }, seed: 1 })).toThrow(
      'Area "town" has an Exit to unknown Area "cave"',
    );
  });

  it("throws naming the Area when an Exit leads to a missing Entry", () => {
    const town = tmj([start, exit(0, 0, "cave", "from-town")]);
    const cave = tmj([start]);

    expect(() => createWorld({ areas: { town, cave }, seed: 1 })).toThrow(
      'Area "town" has an Exit to missing Entry "from-town" in Area "cave"',
    );
  });

  it("throws naming the Area when a spawn is on a blocked tile", () => {
    // Tile (2, 1) has no floor.
    const spawn = {
      name: "",
      type: "monsterSpawn",
      point: true,
      x: 80,
      y: 48,
      properties: [{ name: "monster", type: "string", value: "skeleton" }],
    };

    expect(() =>
      createWorld({ areas: { town: tmj([start, spawn]) }, seed: 1 }),
    ).toThrow('Area "town" has a spawn on blocked tile (2, 1)');
  });

  it("throws naming the Area when an Exit can't be reached from `start`", () => {
    // Three tiles in a row, the middle one without floor.
    const split = {
      ...tmj([]),
      height: 1,
      layers: [
        { type: "tilelayer", name: "floor", data: [1, 0, 1] },
        {
          type: "objectgroup",
          name: "objects",
          objects: [{ ...start, x: 16, y: 16 }, exit(2, 0, "town", "start")],
        },
      ],
    };

    expect(() => createWorld({ areas: { town: split }, seed: 1 })).toThrow(
      'Area "town" has an Exit to "town" that can\'t be reached from "start"',
    );
  });

  it("throws naming a Combat Area without an Area Level", () => {
    const town = tmj([start]);
    const cave = tmj([start]);

    expect(() => createWorld({ areas: { town, cave }, seed: 1 })).toThrow(
      'Area "cave" is a Combat Area without an Area Level',
    );
  });

  it("throws naming Town when it has an Area Level", () => {
    const town = combatArea(tmj([start]), 1);

    expect(() => createWorld({ areas: { town }, seed: 1 })).toThrow(
      'Area "town" has an Area Level; Town has none',
    );
  });

  it("throws naming the Area when its Area Level isn't a whole number from 1", () => {
    const town = tmj([start]);

    for (const bad of [0, 1.5, "2"]) {
      const cave = combatArea(tmj([start]), bad);
      expect(() => createWorld({ areas: { town, cave }, seed: 1 })).toThrow(
        `Area "cave" has a bad Area Level: ${bad}`,
      );
    }
  });

  it("keeps a Combat Area's Area Level", () => {
    const town = tmj([start]);
    const cave = combatArea(tmj([start]), 3);

    const world = createWorld({ areas: { town, cave }, seed: 1 });

    expect(world.areas.cave.areaLevel).toBe(3);
    expect(world.areas.town.areaLevel).toBeNull();
  });

  it("keeps Town's Town Portal spot", () => {
    const spot = { name: "", type: "townPortal", point: true, x: 16, y: 16 };

    const world = createWorld({ areas: { town: tmj([start, spot]) }, seed: 1 });

    expect(world.areas.town.townPortal).toEqual({ x: 0.5, y: 0.5 });
  });

  it("throws naming Town when its Town Portal spot can't be reached from `start`", () => {
    // Tile (2, 1) has no floor.
    const spot = { name: "", type: "townPortal", point: true, x: 80, y: 48 };

    expect(() =>
      createWorld({ areas: { town: tmj([start, spot]) }, seed: 1 }),
    ).toThrow(
      'Area "town" has its Town Portal spot where it can\'t be reached from "start"',
    );
  });

  it("throws naming a Combat Area with a Town Portal spot", () => {
    const spot = { name: "", type: "townPortal", point: true, x: 16, y: 16 };
    const cave = combatArea(tmj([start, spot]));

    expect(() =>
      createWorld({ areas: { town: tmj([start]), cave }, seed: 1 }),
    ).toThrow('Area "cave" has a Town Portal spot; only Town has one');
  });

  it("keeps each NPC's name and place", () => {
    const npc = { name: "Gillian", type: "npc", point: true, x: 16, y: 16 };

    const world = createWorld({ areas: { town: tmj([start, npc]) }, seed: 1 });

    expect(world.areas.town.npcs).toEqual([
      { name: "Gillian", pos: { x: 0.5, y: 0.5 } },
    ]);
  });

  it("reads Entries on isometric maps in tileheight units", () => {
    const iso = {
      ...tmj([{ ...start, x: 16, y: 48 }]),
      orientation: "isometric",
      tilewidth: 64,
    };

    const world = createWorld({ areas: { town: iso }, seed: 1 });

    expect(world.hero.pos).toEqual({ x: 0.5, y: 1.5 });
  });
});

describe("Area tiles", () => {
  // A tileset whose first tile has id 16, as Flare's do.
  const grassland = {
    firstgid: 1,
    name: "grassland",
    tiles: [{ id: 16 }, { id: 17 }, { id: 132 }],
  };
  const gid = (id: number) => grassland.firstgid + id;

  it("keeps floor and prop tiles as tileset tile ids, with null where empty", () => {
    const map = {
      ...tmj([start]),
      tilesets: [grassland],
      layers: [
        {
          type: "tilelayer",
          name: "floor",
          data: [gid(16), gid(17), gid(16), gid(16), gid(16), 0],
        },
        {
          type: "tilelayer",
          name: "walls & props",
          data: [0, 0, gid(132), 0, 0, 0],
        },
        { type: "objectgroup", name: "objects", objects: [start] },
      ],
    };

    const area = createWorld({ areas: { town: map }, seed: 1 }).areas.town;

    expect(area.tileset).toBe("grassland");
    expect(area.floorTiles).toEqual([16, 17, 16, 16, 16, null]);
    expect(area.propTiles).toEqual([null, null, 132, null, null, null]);
  });

  it("reads a tileset from its own file, by the file's name", () => {
    const tsj = {
      type: "tileset",
      name: "grassland",
      tiles: [
        {
          id: 132,
          properties: [{ name: "blocks", type: "bool", value: true }],
        },
      ],
    };
    const map = {
      ...tmj([start]),
      tilesets: [{ firstgid: 5, source: "../tilesets/grassland.tsj" }],
      layers: [
        { type: "tilelayer", name: "floor", data: [5, 5, 5, 5, 5, 0] },
        {
          type: "tilelayer",
          name: "walls & props",
          data: [0, 0, 5 + 132, 0, 0, 0],
        },
        { type: "objectgroup", name: "objects", objects: [start] },
      ],
    };

    const world = createWorld({
      areas: { town: map },
      tilesets: { grassland: tsj },
      seed: 1,
    });

    const area = world.areas.town;
    expect(area.tileset).toBe("grassland");
    expect(area.floorTiles).toEqual([0, 0, 0, 0, 0, null]);
    expect(area.propTiles).toEqual([null, null, 132, null, null, null]);
    expect(area.walkable).toEqual([true, true, false, true, true, false]);
  });

  it("throws naming the Area when its tileset file isn't given", () => {
    const map = {
      ...tmj([start]),
      tilesets: [{ firstgid: 1, source: "../tilesets/cave.tsj" }],
    };

    expect(() => createWorld({ areas: { town: map }, seed: 1 })).toThrow(
      'Area "town" uses unknown tileset "cave"',
    );
  });

  it("throws naming the Area when it uses more than one tileset", () => {
    const map = {
      ...tmj([start]),
      tilesets: [grassland, { ...grassland, firstgid: 500, name: "dungeon" }],
    };

    expect(() => createWorld({ areas: { town: map }, seed: 1 })).toThrow(
      'Area "town" uses 2 tilesets; use one',
    );
  });
});

describe("step", () => {
  it("keeps a resting Hero in place and reports nothing", () => {
    const world = createWorld({ areas: { town: tmj([start]) }, seed: 1 });

    const events = step(world, []);

    expect(events).toEqual([]);
    expect(world.tick).toBe(1);
    expect(world.hero.prevPos).toEqual({ x: 1.5, y: 1.5 });
    expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });
  });
});

// An 8×8 orthogonal Area of open floor, but for a hole at (6, 6), with
// `start` in the middle of (1, 1).
function openFloor() {
  const data = new Array(64).fill(1);
  data[6 * 8 + 6] = 0;
  return {
    orientation: "orthogonal",
    width: 8,
    height: 8,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 8,
        height: 8,
        data,
      },
      { type: "objectgroup", name: "objects", objects: [start] },
    ],
  };
}

function stepTimes(world: World, times: number) {
  for (let i = 0; i < times; i++) step(world, []);
}

describe("MoveTo", () => {
  // At 5.5 tiles/s a 3-tile walk takes 3 / 5.5 s = 32.7 steps, so 33.
  it("walks the Hero to the target and stops on arrival", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });

    step(world, [{ type: "MoveTo", target: { x: 4.5, y: 1.5 } }]);
    stepTimes(world, 31);
    expect(world.hero.pos.x).toBeLessThan(4.5);

    step(world, []);
    expect(world.hero.pos).toEqual({ x: 4.5, y: 1.5 });

    step(world, []);
    expect(world.hero.pos).toEqual({ x: 4.5, y: 1.5 });
  });

  // A 3-4-5 diagonal: 5 / 5.5 s = 54.5 steps, so 55.
  it("walks diagonally in a straight line", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });

    step(world, [{ type: "MoveTo", target: { x: 4.5, y: 5.5 } }]);
    stepTimes(world, 26);
    const { x, y } = world.hero.pos;
    expect((y - 1.5) / (x - 1.5)).toBeCloseTo(4 / 3);

    stepTimes(world, 27);
    expect(world.hero.pos).not.toEqual({ x: 4.5, y: 5.5 });
    step(world, []);
    expect(world.hero.pos).toEqual({ x: 4.5, y: 5.5 });
  });

  // The nearest point is kept the Hero's 0.3-tile radius inside its tile.
  it("walks as near as it can get to a target with no floor", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });

    walkOut(world, { type: "MoveTo", target: { x: 9, y: 1.5 } });
    expect(world.hero.pos.x).toBeCloseTo(7.7);
    expect(world.hero.pos.y).toBeCloseTo(1.5);

    walkOut(world, { type: "MoveTo", target: { x: -0.1, y: 1.5 } });
    expect(world.hero.pos.x).toBeCloseTo(0.3);
    expect(world.hero.pos.y).toBeCloseTo(1.5);
  });

  it("walks next to a hole it was sent into, never into it", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });

    const tiles = walkOut(world, {
      type: "MoveTo",
      target: { x: 6.5, y: 6.5 },
    });

    expect(tiles).not.toContain("6,6");
    const { x, y } = world.hero.pos;
    expect(Math.hypot(x - 6.5, y - 6.5)).toBeLessThan(1);
  });

  it("re-targets mid-walk", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });

    step(world, [{ type: "MoveTo", target: { x: 4.5, y: 1.5 } }]);
    stepTimes(world, 10);
    step(world, [{ type: "MoveTo", target: { x: 1.5, y: 1.5 } }]);
    stepTimes(world, 11);

    expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });
  });
});

// Tileset tiles, as gids: plain floor, a wall that blocks, and two tiles for
// the `blocking override` layer that block and unblock.
const FLOOR = 1;
const WALL = 2;
const BLOCK = 3;
const UNBLOCK = 4;

/**
 * An 8×8 orthogonal Area of floor with `start` in the middle of (1, 1),
 * walls at `walls` and override tiles at `overrides`, as [x, y, gid].
 */
function walled(walls: [number, number][], overrides: number[][] = []) {
  const wallData = new Array(64).fill(0);
  for (const [x, y] of walls) wallData[y * 8 + x] = WALL;
  const overrideData = new Array(64).fill(0);
  for (const [x, y, gid] of overrides) overrideData[y * 8 + x] = gid;
  const layer = (name: string, data: number[]) => ({
    type: "tilelayer",
    name,
    width: 8,
    height: 8,
    data,
  });
  const blocks = (value: boolean) => [{ name: "blocks", type: "bool", value }];
  return {
    orientation: "orthogonal",
    width: 8,
    height: 8,
    tilewidth: 32,
    tileheight: 32,
    tilesets: [
      {
        firstgid: FLOOR,
        name: "test",
        tiles: [
          { id: WALL - 1, properties: blocks(true) },
          { id: BLOCK - 1, properties: blocks(true) },
          { id: UNBLOCK - 1, properties: blocks(false) },
        ],
      },
    ],
    layers: [
      layer("floor", new Array(64).fill(FLOOR)),
      layer("walls & props", wallData),
      layer("blocking override", overrideData),
      { type: "objectgroup", name: "objects", objects: [start] },
    ],
  };
}

/** A wall down column 3 from row 0 to row 5, open at rows 6 and 7. */
const column: [number, number][] = [0, 1, 2, 3, 4, 5].map((y) => [3, y]);

/**
 * Steps until the Hero stops or `limit` steps pass, returning every tile the
 * Hero stood in.
 */
function walkOut(world: World, order: Order, limit = 600) {
  const tiles: string[] = [];
  step(world, [order]);
  for (let i = 0; i < limit; i++) {
    tiles.push(
      `${Math.floor(world.hero.pos.x)},${Math.floor(world.hero.pos.y)}`,
    );
    const before = { ...world.hero.pos };
    step(world, []);
    if (before.x === world.hero.pos.x && before.y === world.hero.pos.y) break;
  }
  return tiles;
}

describe("MoveTo around walls", () => {
  it("walks around a wall to a target behind it, never entering a wall", () => {
    const world = createWorld({ areas: { town: walled(column) }, seed: 1 });

    const tiles = walkOut(world, {
      type: "MoveTo",
      target: { x: 5.5, y: 1.5 },
    });

    expect(world.hero.pos).toEqual({ x: 5.5, y: 1.5 });
    for (const [x, y] of column) expect(tiles).not.toContain(`${x},${y}`);
    expect(tiles).toContain("3,6");
  });

  // Straight across the corner would be √2 / 5.5 s ≈ 16 steps.
  it("doesn't cut between two walls that meet at a corner", () => {
    const corner: [number, number][] = [
      [2, 1],
      [1, 2],
    ];
    const world = createWorld({ areas: { town: walled(corner) }, seed: 1 });

    const tiles = walkOut(world, {
      type: "MoveTo",
      target: { x: 2.5, y: 2.5 },
    });

    expect(world.hero.pos).toEqual({ x: 2.5, y: 2.5 });
    expect(tiles).not.toContain("2,1");
    expect(tiles).not.toContain("1,2");
    expect(tiles.length).toBeGreaterThan(30);
  });

  // Straight through the gap is 4 / 5.5 s ≈ 44 steps.
  it("walks through a wall tile the override layer unblocks", () => {
    const gap = [[3, 1, UNBLOCK]];
    const world = createWorld({
      areas: { town: walled(column, gap) },
      seed: 1,
    });

    const tiles = walkOut(world, {
      type: "MoveTo",
      target: { x: 5.5, y: 1.5 },
    });

    expect(world.hero.pos).toEqual({ x: 5.5, y: 1.5 });
    expect(tiles).toContain("3,1");
    expect(tiles.length).toBeLessThanOrEqual(45);
  });

  it("stops short of floor the override layer blocks", () => {
    const invisible = [[5, 1, BLOCK]];
    const world = createWorld({
      areas: { town: walled([], invisible) },
      seed: 1,
    });

    const tiles = walkOut(world, {
      type: "MoveTo",
      target: { x: 5.5, y: 1.5 },
    });

    expect(tiles).not.toContain("5,1");
    expect(world.hero.pos.x).toBeCloseTo(4.7);
    expect(world.hero.pos.y).toBeCloseTo(1.5);
  });

  it("walks up to a wall it can't get past and stops", () => {
    const wall: [number, number][] = [0, 1, 2, 3, 4, 5, 6, 7].map((y) => [
      3,
      y,
    ]);
    const world = createWorld({ areas: { town: walled(wall) }, seed: 1 });

    walkOut(world, { type: "MoveTo", target: { x: 5.5, y: 1.5 } });

    expect(world.hero.pos.x).toBeCloseTo(2.7);
    expect(world.hero.pos.y).toBeCloseTo(1.5);
  });

  // Stopping at a wall leaves the Hero exactly its radius from it, which
  // must still count as clear.
  it("walks straight along a wall it stopped against", () => {
    const wall: [number, number][] = [0, 1, 2, 3, 4, 5, 6, 7].map((y) => [
      3,
      y,
    ]);
    const world = createWorld({ areas: { town: walled(wall) }, seed: 1 });
    walkOut(world, { type: "MoveTo", target: { x: 5.5, y: 1.5 } });

    step(world, [{ type: "MoveTo", target: { x: 2.7, y: 6.5 } }]);
    for (let i = 0; i < 60; i++) {
      expect(world.hero.pos.x).toBeCloseTo(2.7);
      step(world, []);
    }
    expect(world.hero.pos.y).toBeCloseTo(6.5);
  });

  it("faces the exact direction it walks", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });

    step(world, [{ type: "MoveTo", target: { x: 4.5, y: 5.5 } }]);

    expect(world.hero.facing).toBeCloseTo(Math.atan2(4, 3));
  });
});

/** Gives `Walk` in `direction` on each of `steps` steps. */
function walkFor(world: World, direction: Vec, steps: number) {
  for (let i = 0; i < steps; i++) step(world, [{ type: "Walk", direction }]);
}

/** A wall down the whole of column 3. */
const fullColumn: [number, number][] = [0, 1, 2, 3, 4, 5, 6, 7].map((y) => [
  3,
  y,
]);

describe("Walk", () => {
  // 5.5 tiles/s is 5.5 / 60 tiles a step: 30 steps walk 2.75 tiles.
  it("walks the Hero at walking speed in the direction, given each step", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });

    walkFor(world, { x: 1, y: 0 }, 30);

    expect(world.hero.pos.x).toBeCloseTo(1.5 + 2.75);
    expect(world.hero.pos.y).toBeCloseTo(1.5);
  });

  // A 3-4-5 direction splits the 2.75 tiles 0.6 across and 0.8 down.
  it("walks at walking speed however far the stick is pushed", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });

    walkFor(world, { x: 0.3, y: 0.4 }, 30);

    expect(world.hero.pos.x).toBeCloseTo(1.5 + 2.75 * 0.6);
    expect(world.hero.pos.y).toBeCloseTo(1.5 + 2.75 * 0.8);
    expect(world.hero.facing).toBeCloseTo(Math.atan2(4, 3));
  });

  it("stops the Hero on the step it is no longer given", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });
    walkFor(world, { x: 1, y: 0 }, 10);
    const at = { ...world.hero.pos };

    step(world, []);

    expect(world.hero.pos).toEqual(at);
  });

  it("stops the Hero when given no direction", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });
    walkFor(world, { x: 1, y: 0 }, 10);
    const at = { ...world.hero.pos };

    walkFor(world, { x: 0, y: 0 }, 1);

    expect(world.hero.pos).toEqual(at);
  });

  it("takes over from a MoveTo, which doesn't carry on after", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });
    step(world, [{ type: "MoveTo", target: { x: 5.5, y: 1.5 } }]);

    walkFor(world, { x: 0, y: 1 }, 30);
    const at = { ...world.hero.pos };
    step(world, []);

    expect(world.hero.pos).toEqual(at);
    expect(at.y).toBeGreaterThan(4);
  });

  it("stops against a wall it walks straight into, its radius away", () => {
    const world = createWorld({ areas: { town: walled(fullColumn) }, seed: 1 });

    walkFor(world, { x: 1, y: 0 }, 60);

    expect(world.hero.pos.x).toBeLessThanOrEqual(2.7);
    expect(world.hero.pos.x).toBeGreaterThan(2.6);
    expect(world.hero.pos.y).toBeCloseTo(1.5);
  });

  it("slides along a wall it walks into at an angle", () => {
    const world = createWorld({ areas: { town: walled(fullColumn) }, seed: 1 });

    walkFor(world, { x: 2, y: 1 }, 60);

    expect(world.hero.pos.x).toBeLessThanOrEqual(2.7);
    expect(world.hero.pos.y).toBeGreaterThan(3.5);
  });

  it("slides past the end of a wall and on in the direction", () => {
    const world = createWorld({ areas: { town: walled(column) }, seed: 1 });

    // Down-right: into the wall in column 3, along it and past its end.
    walkFor(world, { x: 1, y: 1 }, 120);

    expect(world.hero.pos.x).toBeGreaterThan(3.5);
  });

  it("takes the Hero through an Exit it walks into", () => {
    const town = tmj([start, exit(0, 1, "cave", "start")]);
    const cave = combatArea(tmj([start]));
    const world = createWorld({ areas: { town, cave }, seed: 1 });

    walkFor(world, { x: -1, y: 0 }, 10);
    while (world.areaChange !== null) step(world, []);

    expect(world.areaName).toBe("cave");
  });
});
