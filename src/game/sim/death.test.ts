import { describe, expect, it } from "vitest";
import {
  createWorld,
  isRegenerating,
  type SimEvent,
  step,
  type World,
} from "./world";

/** A map made a Combat Area by giving it Area Level 1. */
function combatArea(map: object) {
  return {
    ...map,
    properties: [{ name: "areaLevel", type: "int", value: 1 }],
  };
}

/**
 * An orthogonal Area of open floor drawn row by row: `.` floor, `H` the
 * Hero's `start` and `S` a pack of `pack` Skeletons, centred on their tile.
 * `objects` adds more, such as Entries and Exits.
 */
function map(rows: string[], objects: object[] = [], pack = 1) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const all = [...objects];
  [...cells].forEach((cell, i) => {
    const x = i % width;
    const y = Math.floor(i / width);
    if (cell === "H") all.push(entry("start", x, y));
    if (cell === "S") {
      all.push({
        name: "",
        type: "monsterSpawn",
        point: true,
        x: (x + 0.5) * 32,
        y: (y + 0.5) * 32,
        properties: [
          { name: "monster", type: "string", value: "skeleton" },
          { name: "count", type: "int", value: pack },
        ],
      });
    }
  });
  return {
    orientation: "orthogonal",
    width,
    height,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width,
        height,
        data: new Array(width * height).fill(1),
      },
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

// Town's Exit leads into the cave, next to a pack of 7 Skeletons that soon
// kill a Hero who stands there.
const town = map(
  [
    "....", //
    ".H..",
    "....",
  ],
  [exit(3, 1, "cave", "from-town"), entry("from-cave", 2, 1)],
);
const cave = combatArea(
  map(
    [
      "..........", //
      ".H........",
      "..........",
      "....S.....",
      "..........",
      "..........",
    ],
    [exit(0, 3, "town", "from-cave"), entry("from-town", 2, 3)],
    7,
  ),
);

/** A World with the Hero just arrived in the cave. */
function inCave(): World {
  const w = createWorld({ areas: { town, cave }, seed: 1 });
  step(w, [{ type: "MoveTo", target: { x: 3.5, y: 1.5 } }]);
  while (w.areaName !== "cave" || w.areaChange !== null) step(w, []);
  return w;
}

/** Steps with no orders until an event of `type`, failing after `limit`. */
function stepUntil(world: World, type: SimEvent["type"], limit = 60 * 60) {
  for (let i = 0; i < limit; i++) {
    const found = step(world, []).find((event) => event.type === type);
    if (found) return found;
  }
  throw new Error(`No ${type} in ${limit} steps`);
}

describe("dying", () => {
  it("emits HeroDied when Life reaches 0, and then ignores orders", () => {
    const w = inCave();
    const [skeleton] = w.monsters;

    stepUntil(w, "HeroDied");
    expect(w.hero.life).toBe(0);
    const at = { ...w.hero.pos };

    for (let i = 0; i < 120; i++) {
      const events = step(w, [
        { type: "MoveTo", target: { x: 8.5, y: 0.5 } },
        { type: "Attack", monster: skeleton.id },
        { type: "SwingAt", target: skeleton.pos },
      ]);
      expect(events).toEqual([]);
    }
    expect(w.hero.pos).toEqual(at);
    expect(w.hero.swing).toBeNull();
    expect(w.hero.life).toBe(0);
  });

  it("sends every Monster home, healed, and none comes back for the Hero", () => {
    const w = inCave();

    stepUntil(w, "HeroDied");
    expect(w.monsters).toHaveLength(7);
    expect(w.monsters.map((monster) => monster.state)).toEqual(
      new Array(7).fill("return"),
    );

    // Long past the 2 s grace period after getting home, where they heal.
    for (let i = 0; i < 10 * 60; i++) step(w, []);
    for (const monster of w.monsters) {
      expect(["idle", "wander"]).toContain(monster.state);
      expect(monster.life).toBe(60);
    }
  });

  it("doesn't regenerate while dead, however long the Hero lies there", () => {
    const w = inCave();
    stepUntil(w, "HeroDied");

    for (let i = 0; i < 20 * 60; i++) step(w, []);

    expect(isRegenerating(w)).toBe(false);
    expect(w.hero.life).toBe(0);
  });

  // 1 s is 60 steps.
  it("ignores Continue until 1 s after death, then returns to Town at start at full Life", () => {
    const w = inCave();
    stepUntil(w, "HeroDied");

    for (let i = 1; i < 60; i++) {
      expect(step(w, [{ type: "Continue" }])).toEqual([]);
      expect(w.areaChange).toBeNull();
    }

    step(w, [{ type: "Continue" }]);
    expect(w.areaChange).not.toBeNull();
    expect(stepUntil(w, "AreaChanged")).toEqual({
      type: "AreaChanged",
      area: "town",
      entry: "start",
    });
    while (w.areaChange !== null) step(w, []);

    expect(w.hero.pos).toEqual({ x: 1.5, y: 1.5 });
    expect(w.hero.life).toBe(100);
    expect(w.death).toBeNull();
    expect(w.monsters).toEqual([]);
  });

  it("doesn't keep a Continue given too early for later", () => {
    const w = inCave();
    stepUntil(w, "HeroDied");
    for (let i = 1; i < 59; i++) step(w, []);

    step(w, [{ type: "Continue" }]);
    for (let i = 0; i < 60; i++) step(w, []);

    expect(w.areaChange).toBeNull();
    expect(w.death).not.toBeNull();
  });

  it("lets the Hero play on after returning to Town", () => {
    const w = inCave();
    stepUntil(w, "HeroDied");
    for (let i = 0; i < 60; i++) step(w, []);
    step(w, [{ type: "Continue" }]);
    while (w.areaChange !== null) step(w, []);

    step(w, [{ type: "MoveTo", target: { x: 0.5, y: 0.5 } }]);
    for (let i = 0; i < 30; i++) step(w, []);

    expect(w.hero.pos).toEqual({ x: 0.5, y: 0.5 });
  });
});
