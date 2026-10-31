import { describe, expect, it } from "vitest";
import kaykit from "../../content/tilesets/kaykit.tsj";
import { PIECES, type PieceSource, pieceName } from "./pieces.mts";
import TILE_NUMBERS from "./tile-numbers.json";
import { tilesetOf } from "./tileset.mts";

const piece = (model: string): PieceSource => ({
  pack: "halloween",
  model,
  kind: "prop",
  blocks: false,
});

type Tile = { id: number; properties: { name: string; value: unknown }[] };
const numbersOf = (tiles: Tile[]) =>
  Object.fromEntries(
    tiles.map((tile) => [
      tile.properties.find((p) => p.name === "piece")?.value,
      tile.id,
    ]),
  );

describe("the KayKit tileset's tile numbers", () => {
  const record = { "halloween/a": 0, "halloween/b": 1, water: 2 };

  it("keeps every recorded number when a piece is added, and appends the new one", () => {
    const tileset = tilesetOf([piece("a"), piece("new"), piece("b")], record);
    expect(numbersOf(tileset.tiles)).toEqual({
      "halloween/a": 0,
      "halloween/b": 1,
      water: 2,
      "halloween/new": 3,
    });
    expect(tileset.tilecount).toBe(4);
  });

  it("leaves the number of a piece no longer imported unused", () => {
    const tileset = tilesetOf([piece("b")], record);
    expect(numbersOf(tileset.tiles)).toEqual({ "halloween/b": 1, water: 2 });
    expect(tileset.tilecount).toBe(3);
  });

  it("numbers a first import from 0, Water an entry like any other", () => {
    const tileset = tilesetOf([piece("a")], {});
    expect(numbersOf(tileset.tiles)).toEqual({ "halloween/a": 0, water: 1 });
  });

  it("takes the next free number after the highest recorded one", () => {
    const tileset = tilesetOf([piece("a"), piece("new")], { water: 5 });
    expect(numbersOf(tileset.tiles)).toEqual({
      water: 5,
      "halloween/a": 6,
      "halloween/new": 7,
    });
  });
});

describe("the shipped tile numbers", () => {
  it("make Water Tiled tile 49 (id 48 + firstgid 1)", () => {
    expect(TILE_NUMBERS.water).toBe(48);
  });

  it("pin the first and last piece", () => {
    expect(TILE_NUMBERS["dungeon/floor_tile_large"]).toBe(0);
    expect(TILE_NUMBERS["city/bush_C"]).toBe(47);
    expect(Object.keys(TILE_NUMBERS)).toHaveLength(49);
  });

  it("are the numbers of the committed tileset", () => {
    expect(numbersOf((kaykit as { tiles: Tile[] }).tiles)).toEqual(
      TILE_NUMBERS,
    );
  });

  it("make re-running the import change nothing", () => {
    expect(tilesetOf(PIECES, TILE_NUMBERS)).toEqual(kaykit);
    for (const source of PIECES)
      expect(TILE_NUMBERS).toHaveProperty([pieceName(source)]);
  });
});
