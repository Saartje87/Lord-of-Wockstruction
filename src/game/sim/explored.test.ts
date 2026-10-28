import { afterEach, describe, expect, it } from "vitest";
import { saveOf } from "../save";
import { mapTuning } from "../tuning/map";
import { combatArea } from "./testAreas";
import type { Vec } from "./vec";
import {
  createWorld,
  isExplored,
  OPENING_STEPS,
  step,
  townPortalIn,
  type World,
} from "./world";

const { exploredRadius } = mapTuning;
afterEach(() => {
  mapTuning.exploredRadius = exploredRadius;
});

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start` and `P` the Town Portal's spot in Town, each in the middle of its
 * tile. `objects` adds more, such as Entries and Exits.
 */
function map(rows: string[], objects: object[] = []) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const all = [...objects];
  [...cells].forEach((cell, i) => {
    const x = i % width;
    const y = Math.floor(i / width);
    if (cell === "H") all.push(entry("start", x, y));
    if (cell === "P") all.push({ ...entry("", x, y), type: "townPortal" });
  });
  const layer = (name: string, data: number[]) => ({
    type: "tilelayer",
    name,
    width,
    height,
    data,
  });
  return {
    orientation: "orthogonal",
    width,
    height,
    tilewidth: 32,
    tileheight: 32,
    tilesets: [
      {
        firstgid: 1,
        name: "test",
        tiles: [
          {
            id: 1,
            properties: [{ name: "blocks", type: "bool", value: true }],
          },
        ],
      },
    ],
    layers: [
      layer("floor", new Array(width * height).fill(1)),
      layer(
        "walls & props",
        [...cells].map((cell) => (cell === "#" ? 2 : 0)),
      ),
      { type: "objectgroup", name: "objects", objects: all },
    ],
  };
}

/** An Entry in the middle of tile (x, y). */
function entry(name: string, x: number, y: number) {
  return {
    name,
    type: "entry",
    point: true,
    x: (x + 0.5) * 32,
    y: (y + 0.5) * 32,
  };
}

/** An Exit covering tile (x, y), to an Entry in another Area. */
function exit(x: number, y: number, area: string, toEntry: string) {
  return {
    name: "",
    type: "exit",
    x: x * 32,
    y: y * 32,
    width: 32,
    height: 32,
    properties: [
      { name: "area", type: "string", value: area },
      { name: "entry", type: "string", value: toEntry },
    ],
  };
}

// Town's Exit on its east edge leads to the cave's `from-town`.
const town = map(
  [
    "........", //
    ".H..P...",
    "........",
  ],
  [exit(7, 1, "cave", "from-town"), entry("from-cave", 6, 1)],
);
// A wall stands two tiles east of the Hero's arrival; the cave's far Exit
// leads to the den.
const cave = combatArea(
  map(
    [
      "....................", //
      "....................",
      "....................",
      ".H.#................",
      "....................",
      "....................",
      "....................",
    ],
    [
      exit(0, 0, "town", "from-cave"),
      entry("from-town", 1, 3),
      exit(19, 3, "den", "from-cave"),
      entry("from-den", 18, 3),
    ],
  ),
);
const den = combatArea(
  map(
    [
      "......", //
      ".H....",
      "......",
    ],
    [exit(0, 0, "cave", "from-den"), entry("from-cave", 1, 1)],
  ),
);

const AREAS = { town, cave, den };

/** A World with the Hero just arrived in the cave, the reveal radius 4. */
function inCave(): World {
  mapTuning.exploredRadius = 4;
  return createWorld({
    areas: AREAS,
    seed: 1,
    start: { area: "cave", entry: "from-town" },
  });
}

/** Steps with no orders `count` times. */
function stepFor(world: World, count: number) {
  for (let i = 0; i < count; i++) step(world, []);
}

/** Walks the Hero to `target` and on until they stand there. */
function walkTo(world: World, target: Vec) {
  step(world, [{ type: "MoveTo", target }]);
  for (let i = 0; i < 600 && world.hero.path.length > 0; i++) step(world, []);
}

/** Walks the Hero to `target`, into an Exit, and on through the change. */
function leave(world: World, target: Vec) {
  step(world, [{ type: "MoveTo", target }]);
  for (let i = 0; i < 600 && !world.areaChange; i++) step(world, []);
  while (world.areaChange) step(world, []);
}

/** Opens a Town Portal and steps until it has opened. */
function open(world: World) {
  step(world, [{ type: "OpenTownPortal" }]);
  stepFor(world, OPENING_STEPS);
}

/** Whether the tile at (x, y) is Explored. */
function seen(world: World, x: number, y: number) {
  return isExplored(world, { x, y });
}

describe("Explored", () => {
  it("has all of Town Explored from the start", () => {
    const w = createWorld({ areas: AREAS, seed: 1 });

    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 8; x++) expect(seen(w, x, y)).toBe(true);
    }
  });

  it("starts a Combat Area with only the circle around the Entry", () => {
    const w = inCave();

    expect(seen(w, 1, 3)).toBe(true);
    expect(seen(w, 6, 3)).toBe(false);
    // A circle, not a square: 2 tiles either way is in, 3 either way is out.
    expect(seen(w, 3, 5)).toBe(true);
    expect(seen(w, 4, 6)).toBe(false);
    expect(seen(w, 12, 3)).toBe(false);
  });

  it("is not blocked by walls", () => {
    const w = inCave();

    // Behind the wall at (3, 3).
    expect(seen(w, 4, 3)).toBe(true);
  });

  it("reveals a circle of the tuned radius around the Hero as they walk", () => {
    const w = inCave();

    walkTo(w, { x: 12.5, y: 3.5 });

    expect(seen(w, 8, 3)).toBe(true);
    expect(seen(w, 15, 3)).toBe(true);
    expect(seen(w, 17, 3)).toBe(false);
    // What the Hero left behind stays Explored.
    expect(seen(w, 1, 3)).toBe(true);

    mapTuning.exploredRadius = 6;
    stepFor(w, 1);
    expect(seen(w, 17, 3)).toBe(true);
  });

  it("is forgotten on taking an Exit, the Area rebuilt fresh", () => {
    const w = inCave();
    walkTo(w, { x: 12.5, y: 3.5 });
    expect(seen(w, 12, 3)).toBe(true);

    leave(w, { x: 0.5, y: 0.5 });
    expect(w.areaName).toBe("town");
    leave(w, { x: 7.5, y: 1.5 });

    expect(w.areaName).toBe("cave");
    expect(seen(w, 12, 3)).toBe(false);
    expect(seen(w, 1, 3)).toBe(true);
  });

  it("is kept with the Kept Area, back through the Town Portal", () => {
    const w = inCave();
    walkTo(w, { x: 12.5, y: 3.5 });
    open(w);
    const portal = townPortalIn(w);
    if (!portal) throw new Error("no Town Portal here");
    leave(w, portal);
    expect(w.areaName).toBe("town");

    leave(w, { x: 4.5, y: 1.5 });

    expect(w.areaName).toBe("cave");
    expect(seen(w, 1, 3)).toBe(true);
    expect(seen(w, 12, 3)).toBe(true);
    expect(seen(w, 18, 3)).toBe(false);
  });

  it("is kept with the Kept Area, back by an Exit from another Area", () => {
    const w = inCave();
    walkTo(w, { x: 12.5, y: 3.5 });
    // Facing north, so the Town Portal opens off the way to the Exit.
    walkTo(w, { x: 12.5, y: 1.5 });
    open(w);
    leave(w, { x: 19.5, y: 3.5 });
    expect(w.areaName).toBe("den");

    leave(w, { x: 0.5, y: 0.5 });

    expect(w.areaName).toBe("cave");
    expect(seen(w, 12, 3)).toBe(true);
    expect(seen(w, 1, 3)).toBe(true);
  });

  it("is forgotten once the Town Portal closes", () => {
    const w = inCave();
    walkTo(w, { x: 12.5, y: 3.5 });
    // Facing north, so the Town Portal opens off the way to the Exit.
    walkTo(w, { x: 12.5, y: 1.5 });
    open(w);
    leave(w, { x: 19.5, y: 3.5 });
    // A new Town Portal in the den closes the cave's.
    open(w);
    expect(w.areaName).toBe("den");

    leave(w, { x: 0.5, y: 0.5 });

    expect(w.areaName).toBe("cave");
    expect(seen(w, 12, 3)).toBe(false);
  });

  it("is never kept by the Save", () => {
    const w = inCave();
    walkTo(w, { x: 12.5, y: 3.5 });

    expect(JSON.stringify(saveOf(w))).not.toMatch(/explored/i);
  });
});
