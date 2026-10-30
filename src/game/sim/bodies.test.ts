import { describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { minionTuning } from "../tuning/minions";
import { monsterTuning } from "../tuning/monsters";
import { newMinion } from "./minions";
import { tileOf, type Vec } from "./vec";
import { createWorld, type SimEvent, step, type World } from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start` and `S` one Skeleton, both in the middle of their tile.
 */
function map(rows: string[]) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const objects: object[] = [];
  [...cells].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") {
      objects.push({ name: "start", type: "entry", point: true, x, y });
    }
    if (cell === "S") {
      objects.push({
        name: "",
        type: "monsterSpawn",
        point: true,
        x,
        y,
        properties: [{ name: "monster", type: "string", value: "skeleton" }],
      });
    }
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
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

function world(rows: string[], seed = 1): World {
  return createWorld({ areas: { town: map(rows) }, seed });
}

/** Adds a Golem at `pos` to the Hero's Minions. */
function addGolem(w: World, pos: Vec) {
  const golem = newMinion(w.nextMinionId++, "golem", "golem", 1, pos, 0);
  w.minions.push(golem);
  return golem;
}

/** Steps with no orders until `done`, failing after `limit` steps. */
function stepUntil(w: World, done: () => boolean, limit = 600): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; !done(); i++) {
    if (i > limit) throw new Error("Never happened");
    events.push(...step(w, []));
  }
  return events;
}

function distance(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * How far into a wall of `rows`, or past its edge, a Body of `radius` at
 * `pos` reaches: 0 when it touches none.
 */
function intoWall(rows: string[], pos: Vec, radius: number): number {
  const at = tileOf(pos);
  let deepest = 0;
  for (let y = at.y - 1; y <= at.y + 1; y++) {
    for (let x = at.x - 1; x <= at.x + 1; x++) {
      const open = rows[y]?.[x] !== undefined && rows[y][x] !== "#";
      if (open) continue;
      const nearest = {
        x: Math.min(Math.max(pos.x, x), x + 1),
        y: Math.min(Math.max(pos.y, y), y + 1),
      };
      deepest = Math.max(deepest, radius - distance(pos, nearest));
    }
  }
  return deepest;
}

/** The size a Body is checked against walls at: never more than the Hero's. */
const wallSize = (radius: number) => Math.min(radius, heroTuning.radius);

describe("Bodies and walls", () => {
  it("never leaves a shoved Monster with any part of its Body inside a wall", () => {
    // The Hero between two pillars against a wall, a crowd in sight of them
    // shoving each other at it.
    const rows = [
      "#########", //
      "...#H#...",
      ".........",
      "..S.S.S..",
      ".S.S.S.S.",
    ];
    const w = world(rows);
    const strolling = ["idle", "wander"];
    stepUntil(w, () =>
      w.monsters.every(({ state }) => !strolling.includes(state)),
    );

    // Long enough to crowd the Hero, not to kill them.
    for (let i = 0; i < 240; i++) {
      step(w, []);
      expect(w.death).toBeNull();
      for (const skeleton of w.monsters) {
        expect(strolling).not.toContain(skeleton.state);
        const radius = wallSize(monsterTuning[skeleton.type].radius);
        expect(intoWall(rows, skeleton.pos, radius)).toBeLessThan(1e-9);
      }
    }
  });

  it("lets a Golem follow the Hero through a gap exactly as wide as the Hero fits through", () => {
    const rows = [
      "......#......",
      "......#......",
      "..H..........",
      "......#......",
      "......#......",
    ];
    const w = world(rows);
    const golem = addGolem(w, { x: 1.5, y: 2.5 });
    const { followDistance } = minionTuning.golem;
    expect(minionTuning.golem.radius).toBeGreaterThan(heroTuning.radius);

    step(w, [{ type: "MoveTo", target: { x: 11.5, y: 2.5 } }]);
    stepUntil(w, () => w.hero.path.length === 0);
    stepUntil(
      w,
      () => distance(golem.pos, w.hero.pos) <= followDistance + 1e-9,
    );

    expect(golem.pos.x).toBeGreaterThan(7);
  });
});

describe("a Hero in Death", () => {
  it("has no Body: Monsters walk over where they lie without being pushed", () => {
    const w = world([
      "......", //
      "..HS..",
      "......",
    ]);
    w.hero.life = 1;
    stepUntil(w, () => w.death !== null);
    const [skeleton] = w.monsters;
    // Walking home, no faster.
    const { speed, returnSpeed } = monsterTuning.skeleton;
    const walk = ((speed * returnSpeed) / 60) * 1.0001;

    skeleton.pos = { ...w.hero.pos };
    for (let i = 0; i < 30; i++) {
      step(w, []);
      expect(distance(skeleton.prevPos, skeleton.pos)).toBeLessThanOrEqual(
        walk,
      );
    }
  });
});

describe("a crowded fight", () => {
  const crowd = [
    "......S.....",
    "..S.......S.",
    "............",
    "...S........",
    "............",
    "S.....H.....",
    "...........S",
    "............",
    "........S...",
    "..S.......S.",
    "............",
  ];

  /** Every creature's position after the same fight, from the same start. */
  function fight(): Vec[] {
    const w = world(crowd, 7);
    addGolem(w, { x: 7.5, y: 5.5 });
    addGolem(w, { x: 5.5, y: 5.5 });
    for (let i = 0; i < 240; i++) {
      const orders =
        i === 120
          ? [{ type: "MoveTo" as const, target: { x: 0.5, y: 0.5 } }]
          : [];
      step(w, orders);
    }
    return [w.hero, ...w.minions, ...w.monsters].map(({ pos }) => ({ ...pos }));
  }

  it("ends the same way every time", () => {
    expect(fight()).toEqual(fight());
  });
});
