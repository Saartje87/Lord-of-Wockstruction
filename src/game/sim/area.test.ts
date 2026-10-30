import { describe, expect, it } from "vitest";
import { loadArea } from "./area";

/** A KayKit tileset of four pieces: a floor, a Wall, and two Props. */
const kaykit = {
  type: "tileset",
  name: "kaykit",
  tiles: [
    tile(0, "floor_tile_large", "floor", false),
    tile(1, "wall", "wall", true),
    tile(2, "barrel_large", "prop", true),
    tile(3, "candle", "prop", false),
    tile(4, "water", "water", false),
  ],
};

function tile(id: number, piece: string, kind: string, blocks: boolean) {
  return {
    id,
    properties: [
      { name: "piece", type: "string", value: piece },
      { name: "kind", type: "string", value: kind },
      { name: "blocks", type: "bool", value: blocks },
    ],
  };
}

/** A 3×2 orthogonal map on the KayKit tileset (firstgid 1). */
function map(floor: number[], wallsAndProps: number[]) {
  return {
    orientation: "orthogonal",
    width: 3,
    height: 2,
    tilewidth: 32,
    tileheight: 32,
    tilesets: [{ firstgid: 1, source: "../tilesets/kaykit.tsj" }],
    layers: [
      { type: "tilelayer", name: "floor", data: floor },
      { type: "tilelayer", name: "walls & props", data: wallsAndProps },
    ],
  };
}

describe("an Area painted with the KayKit tileset", () => {
  const area = loadArea(
    "town",
    // Floor everywhere but the last cell, which holds a Wall.
    map([1, 1, 1, 1, 1, 0], [0, 0, 3, 4, 0, 2]),
    { kaykit },
  );

  it("knows the piece of every floor cell", () => {
    expect(area.floorPieces).toEqual([
      "floor_tile_large",
      "floor_tile_large",
      "floor_tile_large",
      "floor_tile_large",
      "floor_tile_large",
      null,
    ]);
  });

  it("knows its Walls and Props, with where they stand", () => {
    expect(area.walls).toEqual([{ x: 2, y: 1, piece: "wall", blocks: true }]);
    expect(area.props).toEqual([
      { x: 2, y: 0, piece: "barrel_large", blocks: true },
      { x: 0, y: 1, piece: "candle", blocks: false },
    ]);
  });

  it("takes walkability from `blocks`", () => {
    expect(area.walkable).toEqual([true, true, false, true, true, false]);
  });
});

describe("an Area whose tileset has no pieces", () => {
  it("has no pieces", () => {
    const bare = {
      ...map([1, 1, 1, 1, 1, 0], [0, 0, 0, 0, 0, 0]),
      tilesets: [{ firstgid: 1, name: "plain", tiles: [] }],
    };

    const area = loadArea("town", bare);

    expect(area.floorPieces).toEqual([null, null, null, null, null, null]);
    expect(area.walls).toEqual([]);
    expect(area.props).toEqual([]);
  });
});

describe("an Area's hot springs", () => {
  const water = map([1, 5, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0]);

  it("are marked by the map's `hotSprings` property", () => {
    const marked = {
      ...water,
      properties: [{ name: "hotSprings", type: "bool", value: true }],
    };

    expect(loadArea("spa", marked, { kaykit }).hotSprings).toBe(true);
  });

  it("are off unless the map says so", () => {
    expect(loadArea("pond", water, { kaykit }).hotSprings).toBe(false);
  });
});

describe("an Area with Water", () => {
  // Floor, Water (gid 5) in the middle of the top row, a Prop on the bottom.
  const area = loadArea("pond", map([1, 5, 1, 1, 1, 1], [0, 0, 0, 0, 3, 0]), {
    kaykit,
  });

  it("keeps a grid of which tiles are Water", () => {
    expect(area.water).toEqual([false, true, false, false, false, false]);
  });

  it("makes Water floor that is not walkable", () => {
    expect(area.floor[1]).toBe(true);
    expect(area.walkable).toEqual([true, false, true, true, false, true]);
  });
});
