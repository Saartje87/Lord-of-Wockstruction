import { describe, expect, it } from "vitest";
import type { Area } from "./area";
import { areaMap } from "./areaMap";

/**
 * A Combat Area of `rows`, one string per row: ` ` void, `.` floor, `~`
 * Water, `#` a blocking Wall, `%` a blocking Prop, `!` floor blocked with no
 * piece on it (an invisible wall), `p` a Prop that doesn't block.
 */
function area(rows: string[], extra: Partial<Area> = {}): Area {
  const width = rows[0].length;
  const cells = rows.join("").split("");
  const at = (i: number) => ({ x: i % width, y: Math.floor(i / width) });
  const pieces = (marks: string, blocks: boolean) =>
    cells.flatMap((cell, i) =>
      marks.includes(cell) ? [{ ...at(i), piece: "piece", blocks }] : [],
    );
  return {
    name: "test",
    areaLevel: 1,
    act: 1,
    mainPath: 1,
    outdoors: false,
    hotSprings: false,
    width,
    height: rows.length,
    floor: cells.map((cell) => cell !== " " && cell !== "#"),
    walkable: cells.map((cell) => cell === "." || cell === "p"),
    water: cells.map((cell) => cell === "~"),
    lowWalled: cells.map(() => false),
    floorPieces: cells.map(() => null),
    walls: pieces("#", true),
    props: [...pieces("%", true), ...pieces("p", false)],
    entries: {},
    spawns: [],
    exits: [],
    npcs: [],
    townPortal: null,
    waypoint: null,
    boneAltars: [],
    uniques: [],
    actBoss: null,
    ...extra,
  };
}

/** The grid's lines, between the title and the blank line before the legend. */
function grid(map: string): string[] {
  const lines = map.split("\n");
  return lines.slice(2, lines.indexOf("", 2));
}

describe("an Area's map", () => {
  it("draws the terrain as the sim sees it, under column numbers and beside row numbers", () => {
    const map = areaMap(area(["#.~", "%!p", "  ."]));
    expect(grid(map)).toEqual(["  012", "0 #.~", "1 %!.", "2   ."]);
  });

  it("numbers a wide Area's columns in tens and units, read downwards", () => {
    const rows = Array.from({ length: 11 }, () => ".".repeat(12));
    const lines = grid(areaMap(area(rows)));
    expect(lines.slice(0, 2)).toEqual(["             11", "   012345678901"]);
    expect(lines[2]).toBe(" 0 ............");
    expect(lines[12]).toBe("10 ............");
  });

  it("marks what the Area places over the terrain, by the tile each stands in", () => {
    const map = areaMap(
      area(["..........", "..........", "~~~~~~~~~~"], {
        exits: [
          { area: "town", entry: "fromTest", x: 7, y: 1, width: 3, height: 2 },
        ],
        entries: { start: { x: 0.5, y: 0.5 } },
        spawns: [
          { monster: "skeleton", count: 3, pos: { x: 1.2, y: 0.9 } },
          { monster: "zombie", count: 1, pos: { x: 2, y: 0 } },
          { monster: "skeleton_archer", count: 2, pos: { x: 2, y: 1 } },
        ],
        uniques: [
          { name: "Bruckle", monster: "wockbrute", pos: { x: 3, y: 0 } },
        ],
        actBoss: {
          name: "Grave Wockington",
          monster: "grave_wockington",
          pos: { x: 4, y: 0 },
        },
        npcs: [
          { name: "Smith", pos: { x: 5, y: 0 }, stands: null, vendor: false },
        ],
        waypoint: { x: 6, y: 0 },
        townPortal: { x: 3, y: 1 },
        boneAltars: [{ x: 4, y: 1 }],
      }),
    );
    expect(grid(map)).toEqual([
      "  0123456789",
      "0 @szUBNW...",
      "1 ..aPA..>>>",
      "2 ~~~~~~~>>>",
    ]);
  });

  it("draws the marker that comes first in the legend where two share a tile", () => {
    const map = areaMap(
      area(["."], {
        entries: { start: { x: 0, y: 0 } },
        spawns: [{ monster: "zombie", count: 1, pos: { x: 0, y: 0 } }],
        uniques: [
          { name: "Bruckle", monster: "wockbrute", pos: { x: 0, y: 0 } },
        ],
      }),
    );
    expect(grid(map)).toEqual(["  0", "0 U"]);
  });

  it("explains every character it draws in a legend, and only those", () => {
    const map = areaMap(
      area(["...~.", "#..%."], {
        entries: { start: { x: 0, y: 0 }, fromTown: { x: 1.5, y: 0.5 } },
        exits: [
          { area: "town", entry: "fromSpa", x: 1, y: 1, width: 2, height: 1 },
        ],
        spawns: [
          { monster: "wockwolf", count: 2, pos: { x: 2, y: 0 } },
          { monster: "wockwolf", count: 1, pos: { x: 2, y: 1 } },
        ],
        uniques: [
          { name: "Bruckle", monster: "wockbrute", pos: { x: 4, y: 1 } },
        ],
      }),
    );
    const lines = map.split("\n");
    expect(lines.slice(lines.indexOf("Terrain"))).toEqual([
      "Terrain",
      "  .  floor",
      "  ~  Water",
      "  #  a blocking Wall",
      "  %  a blocking Prop",
      "",
      "Markers, the first listed winning a tile two share",
      "  U  Unique Monster Bruckle (Wockbrute) at (4, 1)",
      "  w  2 Wockwolf at (2, 0)",
      "  w  1 Wockwolf at (2, 1)",
      '  @  Entry "start" at (0, 0)',
      '  @  Entry "fromTown" at (1, 0)',
      '  >  Exit to town, Entry "fromSpa", at x 1–2, y 1',
      "",
    ]);
  });

  it("names the Area, its size and its Area Level", () => {
    expect(areaMap(area(["."])).split("\n")[0]).toBe("test: 1×1, Area Level 1");
    expect(areaMap(area(["."], { areaLevel: null })).split("\n")[0]).toBe(
      "test: 1×1",
    );
  });
});
