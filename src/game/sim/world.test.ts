import { describe, expect, it } from "vitest";
import town from "../../../content/areas/town.tmj";
import grassland from "../../../content/tilesets/grassland.tsj";
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

describe("createWorld", () => {
  it("puts the Hero in Town at the `start` Entry", () => {
    const world = createWorld({ areas: { town: tmj([start]) }, seed: 1 });

    expect(world.areaName).toBe("town");
    expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });
  });

  it("puts the Hero at `start` in the shipped Town", () => {
    const world = createWorld({
      areas: { town },
      tilesets: { grassland },
      seed: 1,
    });

    expect(world.hero.pos).toEqual({ x: 5.5, y: 4.5 });
  });

  it("blocks the shipped Town's walls by their tileset, and not its plants", () => {
    const world = createWorld({
      areas: { town },
      tilesets: { grassland },
      seed: 1,
    });
    const area = world.areas.town;
    const at = (x: number, y: number) => y * area.width + x;

    expect(area.tileset).toBe("grassland");
    // Rock pillars on both legs of the L, and a tree.
    expect(area.propTiles[at(4, 2)]).toBe(132);
    expect(area.walkable[at(4, 2)]).toBe(false);
    expect(area.walkable[at(8, 4)]).toBe(false);
    expect(area.walkable[at(3, 7)]).toBe(false);
    expect(area.walkable[at(11, 4)]).toBe(false);
    // A fern.
    expect(area.propTiles[at(6, 6)]).toBe(120);
    expect(area.walkable[at(6, 6)]).toBe(true);
  });

  it("throws naming the Area when it has no `start` Entry", () => {
    const elsewhere = { ...start, name: "from-cave" };

    expect(() =>
      createWorld({ areas: { town: tmj([elsewhere]) }, seed: 1 }),
    ).toThrow('Area "town" has no "start" Entry');
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
