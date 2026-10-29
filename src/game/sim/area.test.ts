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

describe("an Area painted with the Flare tileset", () => {
  it("has no pieces", () => {
    const flare = {
      ...map([1, 1, 1, 1, 1, 0], [0, 0, 0, 0, 0, 0]),
      tilesets: [{ firstgid: 1, name: "grassland", tiles: [] }],
    };

    const area = loadArea("town", flare);

    expect(area.floorPieces).toEqual([null, null, null, null, null, null]);
    expect(area.walls).toEqual([]);
    expect(area.props).toEqual([]);
  });
});

describe("an Area with a Flare version to draw in the 2D World", () => {
  it("draws the Flare version's tiles and tileset, and plays the KayKit one", () => {
    const flare = {
      ...map([1, 1, 1, 1, 1, 0], [0, 0, 0, 0, 0, 0]),
      tilesets: [{ firstgid: 1, name: "grassland", tiles: [] }],
    };

    const area = loadArea(
      "town",
      map([1, 1, 1, 1, 1, 0], [0, 0, 3, 0, 0, 0]),
      { kaykit },
      flare,
    );

    expect(area.tileset).toBe("grassland");
    expect(area.floorTiles).toEqual([0, 0, 0, 0, 0, null]);
    expect(area.walkable[2]).toBe(false);
  });
});
