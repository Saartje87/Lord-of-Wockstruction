import { describe, expect, it } from "vitest";
import {
  areaFade,
  createWorld,
  isInCombat,
  type SimEvent,
  step,
  type World,
} from "./world";

/** A map made a Combat Area by giving it Area Level `areaLevel`. */
function combatArea(map: object, areaLevel = 1) {
  return {
    ...map,
    properties: [{ name: "areaLevel", type: "int", value: areaLevel }],
  };
}

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start` and `S` one Skeleton, both in the middle of their tile. `objects`
 * adds more, such as Entries and Exits.
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
    if (cell === "S") all.push(skeleton(x + 0.5, y + 0.5));
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

/** One Skeleton's spawn at (x, y), in tile units. */
function skeleton(x: number, y: number) {
  return {
    name: "",
    type: "monsterSpawn",
    point: true,
    x: x * 32,
    y: y * 32,
    properties: [{ name: "monster", type: "string", value: "skeleton" }],
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

// Town's Exit on its east edge leads to `from-town` by the cave's west edge,
// and the cave's Exit next to it leads back to `from-cave`.
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
      "......", //
      ".H....",
      ".....S",
      "......",
      "......",
    ],
    [exit(0, 2, "town", "from-cave"), entry("from-town", 1, 2)],
  ),
);

function world(): World {
  return createWorld({ areas: { town, cave }, seed: 1 });
}

/** Steps with no orders until an event of `type` or `limit` steps pass. */
function stepUntil(world: World, type: SimEvent["type"], limit = 200) {
  for (let i = 0; i < limit; i++) {
    const found = step(world, []).find((event) => event.type === type);
    if (found) return found;
  }
  return null;
}

/** Walks the Hero to a point in an Exit and on through the whole change. */
function walkThrough(world: World, target: { x: number; y: number }) {
  step(world, [{ type: "MoveTo", target }]);
  const arrived = stepUntil(world, "AreaChanged");
  while (world.areaChange !== null) step(world, []);
  return arrived;
}

describe("Exits", () => {
  it("takes the Hero to the target Entry, facing away from the edge", () => {
    const w = world();

    step(w, [{ type: "MoveTo", target: { x: 3.5, y: 1.5 } }]);
    const event = stepUntil(w, "AreaChanged");

    expect(event).toEqual({
      type: "AreaChanged",
      area: "cave",
      entry: "from-town",
    });
    expect(w.areaName).toBe("cave");
    expect(w.hero.pos).toEqual({ x: 1.5, y: 2.5 });
    // Away from the west edge: along +x.
    expect(w.hero.facing).toBe(0);
  });

  // 300 ms is 18 steps: 9 fading out, the swap, 9 fading back in.
  it("fades out and back in over 300 ms while the World stands still", () => {
    const w = world();
    step(w, [{ type: "MoveTo", target: { x: 3.5, y: 1.5 } }]);
    while (w.areaChange === null) step(w, []);
    const entered = { ...w.hero.pos };

    const fades: number[] = [];
    let arrivedAt = -1;
    for (let i = 1; w.areaChange !== null; i++) {
      const events = step(w, []);
      if (events.some((event) => event.type === "AreaChanged")) arrivedAt = i;
      else if (w.areaName === "town") expect(w.hero.pos).toEqual(entered);
      fades.push(areaFade(w));
    }

    expect(fades).toHaveLength(18);
    expect(arrivedAt).toBe(9);
    expect(fades[8]).toBe(1);
    expect(fades.slice(0, 9)).toEqual([...fades.slice(0, 9)].sort());
    expect(fades.slice(8)).toEqual([...fades.slice(8)].sort().reverse());
    expect(fades[17]).toBe(0);
  });

  it("holds the new Area's Monsters still until the fade ends", () => {
    const w = world();
    step(w, [{ type: "MoveTo", target: { x: 3.5, y: 1.5 } }]);
    stepUntil(w, "AreaChanged");
    const placed = w.monsters.map((monster) => ({ ...monster.pos }));

    while (w.areaChange !== null) step(w, []);

    expect(w.monsters.map((monster) => monster.pos)).toEqual(placed);
  });

  it("ignores orders given during the change", () => {
    const w = world();
    step(w, [{ type: "MoveTo", target: { x: 3.5, y: 1.5 } }]);
    while (w.areaChange === null) step(w, []);

    step(w, [{ type: "MoveTo", target: { x: 5.5, y: 4.5 } }]);
    stepUntil(w, "AreaChanged");
    step(w, [{ type: "MoveTo", target: { x: 5.5, y: 4.5 } }]);
    while (w.areaChange !== null) step(w, []);
    for (let i = 0; i < 30; i++) step(w, []);

    expect(w.hero.pos).toEqual({ x: 1.5, y: 2.5 });
  });

  it("restores the Hero's Life to full on arriving in Town, and no Monster follows", () => {
    const w = world();
    walkThrough(w, { x: 3.5, y: 1.5 });
    expect(stepUntil(w, "HeroHit")).not.toBeNull();

    step(w, [{ type: "MoveTo", target: { x: 0.5, y: 2.5 } }]);
    while (w.areaChange === null) step(w, []);
    expect(w.hero.life).toBeLessThan(100);
    const arrived = stepUntil(w, "AreaChanged");

    expect(arrived).toEqual({
      type: "AreaChanged",
      area: "town",
      entry: "from-cave",
    });
    expect(w.hero.life).toBe(100);
    expect(isInCombat(w)).toBe(false);
    expect(w.monsters).toEqual([]);
  });

  // The cave stands in for the Combat Area.
  it("carries the Hero's Life over into the cave", () => {
    const hostile = map(
      [
        "....", //
        ".H..",
        ".S..",
      ],
      [exit(3, 1, "cave", "from-town"), entry("from-cave", 2, 1)],
    );
    const w = createWorld({ areas: { town: hostile, cave }, seed: 1 });
    expect(stepUntil(w, "HeroHit")).not.toBeNull();

    step(w, [{ type: "MoveTo", target: { x: 3.5, y: 1.5 } }]);
    while (w.areaChange === null) step(w, []);
    const life = w.hero.life;
    expect(life).toBeLessThan(100);
    expect(stepUntil(w, "AreaChanged")).not.toBeNull();

    expect(w.areaName).toBe("cave");
    expect(w.hero.life).toBe(life);
  });

  it("rebuilds the cave fresh on re-entry: every Monster back, no Corpses", () => {
    const w = world();
    walkThrough(w, { x: 3.5, y: 1.5 });
    const [skeleton] = w.monsters;
    let died = false;
    for (let i = 0; i < 600 && !died; i++) {
      const events = step(w, [{ type: "Attack", monster: skeleton.id }]);
      died = events.some((event) => event.type === "MonsterDied");
    }
    expect(w.monsters).toEqual([]);
    expect(w.corpses).toHaveLength(1);

    walkThrough(w, { x: 0.5, y: 2.5 });
    expect(w.corpses).toEqual([]);
    walkThrough(w, { x: 3.5, y: 1.5 });

    expect(w.areaName).toBe("cave");
    expect(w.monsters).toHaveLength(1);
    expect(w.monsters[0].life).toBe(60);
    expect(w.monsters[0].pos).toEqual({ x: 5.5, y: 2.5 });
    expect(w.corpses).toEqual([]);
  });

  // A swing's landed hit allows a move out of its follow-through on the same
  // step, which can walk straight into an Exit as the hitstop starts.
  it("leaves a hitstop behind, so the Hero walks on arriving", () => {
    const edge = map(
      [
        "....", //
        "....",
        "....",
      ],
      [
        // Just short of the Exit, with a Skeleton in reach.
        { ...entry("start", 0, 0), x: 1.95 * 32, y: 1.5 * 32 },
        skeleton(1.95, 2.45),
        exit(2, 1, "cave", "from-town"),
        entry("from-cave", 0, 0),
      ],
    );
    const w = createWorld({ areas: { town: edge, cave }, seed: 1 });
    step(w, [{ type: "SwingAt", target: { x: 1.95, y: 2.45 } }]);
    let landed = false;
    while (!landed) {
      const events = step(w, [{ type: "MoveTo", target: { x: 2.5, y: 1.5 } }]);
      landed = events.some((event) => event.type === "HitLanded");
    }
    expect(w.areaChange).not.toBeNull();
    while (w.areaChange !== null) step(w, []);

    step(w, [{ type: "MoveTo", target: { x: 3.5, y: 2.5 } }]);

    expect(w.hero.pos).not.toEqual({ x: 1.5, y: 2.5 });
  });
});
