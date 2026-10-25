import { describe, expect, it } from "vitest";
import type { Vec } from "./vec";
import { createWorld, type Monster, step, type World } from "./world";

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

function stepTimes(world: World, times: number) {
  for (let i = 0; i < times; i++) step(world, []);
}

function distance(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Where `monster` stands after each of the next `times` steps. */
function track(world: World, monster: Monster, times: number): Vec[] {
  const positions: Vec[] = [];
  for (let i = 0; i < times; i++) {
    step(world, []);
    positions.push({ ...monster.pos });
  }
  return positions;
}

describe("wandering", () => {
  it("strolls within 2.5 tiles of its spawn at 35% speed, pausing 1–3.5 s", () => {
    const w = world([
      "H.#.........", //
      "..#.........",
      "###.........",
      "............",
      "........S...",
      "............",
      "............",
    ]);
    const [skeleton] = w.monsters;
    const home = { ...skeleton.pos };

    const positions = track(w, skeleton, 60 * 60);
    let paused = 0;
    const pauses: number[] = [];
    let at = home;
    for (const pos of positions) {
      expect(skeleton.state).not.toBe("chase");
      expect(distance(pos, home)).toBeLessThanOrEqual(2.5);
      const moved = distance(at, pos);
      if (moved === 0) {
        paused += 1;
      } else {
        expect(moved).toBeLessThanOrEqual((0.35 * 2.8) / 60 + 1e-9);
        if (paused > 0) pauses.push(paused);
        paused = 0;
      }
      at = pos;
    }
    expect(pauses.length).toBeGreaterThan(10);
    // The first pause is cut short by the start of the track.
    for (const steps of pauses.slice(1)) {
      expect(steps).toBeGreaterThanOrEqual(60);
      expect(steps).toBeLessThanOrEqual(212);
    }
  });
});

describe("noticing the Hero", () => {
  it("chases the Hero at 2.8 tiles/s once within 7 tiles in sight", () => {
    const w = world(["H.....S..."]);
    const [skeleton] = w.monsters;

    step(w, []);
    expect(skeleton.state).toBe("chase");
    const [a, b] = track(w, skeleton, 2);
    expect(distance(a, b)).toBeCloseTo(2.8 / 60);
    expect(b.x).toBeLessThan(a.x);
  });

  it("doesn't see the Hero behind a wall, nor beyond 7 tiles", () => {
    const w = world([
      "H..#.S....", //
      "...#......",
      "..........",
      ".........S",
    ]);

    stepTimes(w, 60);
    for (const skeleton of w.monsters) expect(skeleton.state).not.toBe("chase");
  });

  it("wakes Skeletons within 1.5 tiles, but not those further along a chain", () => {
    // Only the first is within 7 tiles of the Hero. Each is 1.41 tiles from
    // the next.
    const w = world([
      "H.....S..", //
      ".......S.",
      "........S",
    ]);
    const [first, second, third] = w.monsters;

    step(w, []);
    expect(first.state).toBe("chase");
    expect(second.state).toBe("chase");
    expect(third.state).not.toBe("chase");
    stepTimes(w, 30);
    expect(third.state).not.toBe("chase");
  });
});

describe("chasing", () => {
  it("stops at reach, 1.2 tiles from the Hero", () => {
    const w = world(["H.....S..."]);
    const [skeleton] = w.monsters;

    stepTimes(w, 180);
    expect(skeleton.state).toBe("chase");
    expect(distance(skeleton.pos, w.hero.pos)).toBeCloseTo(1.2);
    const [a, b] = track(w, skeleton, 2);
    expect(b).toEqual(a);
  });

  it("walks around a wall to a Hero gone behind it, never entering it", () => {
    const w = world([
      ".....#....", //
      ".....#....",
      ".....#....",
      "..H.....S.",
      "..........",
    ]);
    const [skeleton] = w.monsters;
    step(w, []);
    expect(skeleton.state).toBe("chase");

    step(w, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
    const area = w.areas.town;
    for (const pos of track(w, skeleton, 600)) {
      const { x, y } = { x: Math.floor(pos.x), y: Math.floor(pos.y) };
      expect(area.walkable[y * area.width + x]).toBe(true);
    }
    expect(distance(skeleton.pos, w.hero.pos)).toBeCloseTo(1.2);
  });
});

describe("giving up", () => {
  /** Steps until `done` holds, failing after `limit` steps; returns the count. */
  function stepUntil(world: World, done: () => boolean, limit = 1200) {
    for (let i = 1; i <= limit; i++) {
      step(world, []);
      if (done()) return i;
    }
    throw new Error(`Still waiting after ${limit} steps`);
  }

  /**
   * Has a hit Skeleton chase the Hero past its leash and walk home, with the
   * Hero coming back to wait 4 tiles from its home.
   */
  function sendHome() {
    const w = world([
      "......................", //
      "...................HS.",
      "......................",
    ]);
    const [skeleton] = w.monsters;
    const home = { ...skeleton.pos };
    step(w, [{ type: "SwingAt", target: home }]);
    stepUntil(w, () => w.hero.swing === null);
    expect(skeleton.life).toBeLessThan(60);

    // The Hero outruns it.
    step(w, [{ type: "MoveTo", target: { x: 0.5, y: 1.5 } }]);
    stepUntil(w, () => skeleton.state === "return");
    expect(distance(skeleton.pos, home)).toBeGreaterThan(14);
    expect(distance(skeleton.pos, home)).toBeLessThan(14.1);
    const [a, b] = track(w, skeleton, 2);
    expect(distance(a, b)).toBeCloseTo((1.2 * 2.8) / 60);
    expect(b.x).toBeGreaterThan(a.x);

    // It ignores the Hero coming back with it, and waiting by its home.
    step(w, [{ type: "MoveTo", target: { x: 16.5, y: 1.5 } }]);
    stepUntil(w, () => skeleton.state !== "return");
    return { w, skeleton, home };
  }

  it("walks home beyond 14 tiles from it, heals to full, then waits 2 s before noticing again", () => {
    const { w, skeleton, home } = sendHome();
    expect(skeleton.pos).toEqual(home);
    expect(skeleton.life).toBe(60);

    stepTimes(w, 115);
    expect(skeleton.state).not.toBe("chase");
    stepTimes(w, 10);
    expect(skeleton.state).toBe("chase");
  });

  it("notices the Hero hitting it even while waiting at home", () => {
    const { w, skeleton, home } = sendHome();

    step(w, [{ type: "MoveTo", target: { x: home.x - 1, y: home.y } }]);
    const steps = stepUntil(w, () => w.hero.path.length === 0);
    step(w, [{ type: "SwingAt", target: home }]);
    stepUntil(w, () => skeleton.life < 60);
    expect(steps).toBeLessThan(100);
    expect(skeleton.state).toBe("chase");
  });
});

/**
 * The nearest any two Skeletons stand, centre to centre, and the nearest any
 * stands to the Hero.
 */
function gaps(world: World) {
  let skeletons = Number.POSITIVE_INFINITY;
  let hero = Number.POSITIVE_INFINITY;
  for (const [i, a] of world.monsters.entries()) {
    hero = Math.min(hero, distance(a.pos, world.hero.pos));
    for (const b of world.monsters.slice(i + 1)) {
      skeletons = Math.min(skeletons, distance(a.pos, b.pos));
    }
  }
  return { skeletons, hero };
}

describe("a crowd", () => {
  // Ten Skeletons, all within 7 tiles of the Hero.
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

  it("surrounds the Hero without overlapping", () => {
    const w = world(crowd);

    stepTimes(w, 600);
    for (const skeleton of w.monsters) {
      expect(skeleton.state).toBe("chase");
      expect(distance(skeleton.pos, w.hero.pos)).toBeLessThan(2.5);
    }
    // The Skeletons' radii are 0.32 and the Hero's 0.3.
    expect(gaps(w).skeletons).toBeGreaterThan(0.63);
    expect(gaps(w).hero).toBeGreaterThan(0.61);
  });

  it("makes way for the Hero walking through, never moving them", () => {
    const w = world(crowd);
    stepTimes(w, 600);

    step(w, [{ type: "MoveTo", target: { x: 0.5, y: 5.5 } }]);
    for (let i = 0; i < 120; i++) {
      step(w, []);
      expect(gaps(w).hero).toBeGreaterThan(0.55);
    }
    expect(w.hero.pos).toEqual({ x: 0.5, y: 5.5 });
  });

  it("crowds a Hero backed into a corner without overlapping", () => {
    const w = world([
      "H.....", //
      "..S.S.",
      "......",
      ".S.S..",
      "......",
      ".S..S.",
    ]);

    stepTimes(w, 600);
    expect(gaps(w).skeletons).toBeGreaterThan(0.63);
    expect(gaps(w).hero).toBeGreaterThan(0.61);
    expect(w.hero.pos).toEqual({ x: 0.5, y: 0.5 });
  });
});
