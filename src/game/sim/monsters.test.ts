import { describe, expect, it } from "vitest";
import type { Vec } from "./vec";
import {
  createWorld,
  type Monster,
  type MonsterState,
  type Order,
  type SimEvent,
  step,
  type World,
} from "./world";

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

/** The states of a Monster going after the Hero. */
const AFTER_HERO: MonsterState[] = ["chase", "windup", "recover"];

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
      expect(AFTER_HERO).not.toContain(skeleton.state);
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
    for (const skeleton of w.monsters)
      expect(AFTER_HERO).not.toContain(skeleton.state);
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
    expect(AFTER_HERO).not.toContain(third.state);
    stepTimes(w, 30);
    expect(AFTER_HERO).not.toContain(third.state);
  });
});

describe("chasing", () => {
  it("stops at reach, 1.2 tiles from the Hero", () => {
    const w = world(["H.....S..."]);
    const [skeleton] = w.monsters;

    stepTimes(w, 180);
    expect(AFTER_HERO).toContain(skeleton.state);
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

    step(w, [{ type: "MoveTo", target: { x: 4.5, y: 0.5 } }]);
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
  function sendHome(seed = 1) {
    const w = world(
      [
        "......................", //
        "...................HS.",
        "......................",
      ],
      seed,
    );
    const [skeleton] = w.monsters;
    const home = { ...skeleton.pos };
    // Swinging again on a Miss.
    while (skeleton.life === 60) {
      step(w, [{ type: "SwingAt", target: home }]);
      stepUntil(w, () => w.hero.swing === null);
    }

    // The Hero outruns it, walking on after any flinch.
    for (let i = 0; skeleton.state !== "return"; i++) {
      if (i === 1200) throw new Error("Still chased after 1200 steps");
      step(w, [{ type: "MoveTo", target: { x: 0.5, y: 1.5 } }]);
    }
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
    expect(AFTER_HERO).not.toContain(skeleton.state);
    stepTimes(w, 10);
    expect(AFTER_HERO).toContain(skeleton.state);
  });

  it("notices the Hero hitting it even while waiting at home", () => {
    const { w, skeleton, home } = sendHome();

    step(w, [{ type: "MoveTo", target: { x: home.x - 1, y: home.y } }]);
    const steps = stepUntil(w, () => w.hero.path.length === 0);
    step(w, [{ type: "SwingAt", target: home }]);
    stepUntil(w, () => skeleton.life < 60);
    expect(steps).toBeLessThan(100);
    expect(AFTER_HERO).toContain(skeleton.state);
  });

  it("notices the Hero Missing it even while waiting at home", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { w, skeleton, home } = sendHome(seed);
      step(w, [{ type: "MoveTo", target: { x: home.x - 1, y: home.y } }]);
      const steps = stepUntil(w, () => w.hero.path.length === 0);
      expect(steps).toBeLessThan(100);
      const swing = [step(w, [{ type: "SwingAt", target: home }])];
      while (w.hero.swing) swing.push(step(w, []));
      if (!swing.flat().some((event) => event.type === "Missed")) continue;

      expect(skeleton.life).toBe(60);
      expect(AFTER_HERO).toContain(skeleton.state);
      return;
    }
    throw new Error("No seed in 50 Missed the waiting Skeleton");
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

  // Long enough for every Skeleton to arrive, not for them to kill the Hero.
  const SURROUND_STEPS = 4 * 60;

  it("surrounds the Hero without overlapping", () => {
    const w = world(crowd);

    stepTimes(w, SURROUND_STEPS);
    expect(w.death).toBeNull();
    for (const skeleton of w.monsters) {
      expect(AFTER_HERO).toContain(skeleton.state);
      expect(distance(skeleton.pos, w.hero.pos)).toBeLessThan(2.5);
    }
    // The Skeletons' radii are 0.32 and the Hero's 0.3.
    expect(gaps(w).skeletons).toBeGreaterThan(0.63);
    expect(gaps(w).hero).toBeGreaterThan(0.61);
  });

  it("blocks the Hero walking through, who can't walk out of the ring", () => {
    const w = world(crowd);
    stepTimes(w, SURROUND_STEPS);
    const start = { ...w.hero.pos };

    step(w, [{ type: "MoveTo", target: { x: 0.5, y: 5.5 } }]);
    for (let i = 0; i < 40; i++) {
      step(w, []);
      expect(gaps(w).hero).toBeGreaterThan(0.61);
    }
    expect(distance(w.hero.pos, start)).toBeLessThan(1);
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

/** Keeps every Monster where it stands, noticing and wandering no more. */
function pin(world: World) {
  for (const monster of world.monsters) {
    monster.grace = 1e9;
    monster.pause = 1e9;
  }
}

/** The nearest the Hero comes to a Monster over `times` steps of `orders`. */
function nearestToMonster(world: World, times: number, orders: Order[]) {
  const [monster] = world.monsters;
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < times; i++) {
    step(world, i === 0 ? orders : []);
    nearest = Math.min(nearest, distance(world.hero.pos, monster.pos));
  }
  return nearest;
}

describe("a Monster standing in the Hero's way", () => {
  // The Skeleton's radius is 0.32 and the Hero's 0.3.
  const SUM = 0.62;

  it("is walked around when there is room", () => {
    const w = world([
      "..........",
      "..........",
      "H...S.....",
      "..........",
      "..........",
    ]);
    pin(w);
    const monsterAt = { ...w.monsters[0].pos };

    const nearest = nearestToMonster(w, 300, [
      { type: "MoveTo", target: { x: 8.5, y: 2.5 } },
    ]);

    expect(nearest).toBeGreaterThan(SUM - 1e-6);
    expect(w.monsters[0].pos).toEqual(monsterAt);
    expect(distance(w.hero.pos, { x: 8.5, y: 2.5 })).toBeLessThan(0.01);
  });

  it("stops the Hero against it in a one-tile corridor", () => {
    const w = world(["#########", "H...S....", "#########"]);
    pin(w);
    const monsterAt = { ...w.monsters[0].pos };

    const nearest = nearestToMonster(w, 300, [
      { type: "MoveTo", target: { x: 8.5, y: 1.5 } },
    ]);

    expect(nearest).toBeGreaterThan(SUM - 1e-6);
    expect(nearest).toBeLessThan(1);
    expect(w.monsters[0].pos).toEqual(monsterAt);
    expect(w.hero.pos.x).toBeLessThan(monsterAt.x);
  });

  it("is slid along when walking into it at an angle", () => {
    const w = world([
      "..........",
      "..........",
      "H..S......",
      "..........",
      "..........",
    ]);
    pin(w);
    const monsterAt = { ...w.monsters[0].pos };

    const nearest = nearestToMonster(w, 240, [
      { type: "Walk", direction: { x: 1, y: 0.1 } },
    ]);
    // Keys keep being held.
    for (let i = 0; i < 120; i++) {
      step(w, [{ type: "Walk", direction: { x: 1, y: 0.1 } }]);
      expect(distance(w.hero.pos, monsterAt)).toBeGreaterThan(SUM - 1e-6);
    }

    expect(nearest).toBeGreaterThan(SUM - 1e-6);
    expect(w.monsters[0].pos).toEqual(monsterAt);
    expect(w.hero.pos.x).toBeGreaterThan(monsterAt.x + 1);
  });
});

/** Steps until `monster` starts winding up, returning that step's events. */
function untilWindUp(world: World, monster: Monster): SimEvent[] {
  for (let i = 0; i < 600; i++) {
    const events = step(world, []);
    if (monster.state === "windup") return events;
  }
  throw new Error("Never wound up");
}

/** The HeroHit events of each of the next `times` steps. */
function heroHits(world: World, times: number, orders: Order[] = []) {
  const hits: SimEvent[][] = [];
  for (let i = 0; i < times; i++) {
    const events = step(world, i === 0 ? orders : []);
    hits.push(events.filter((event) => event.type === "HeroHit"));
  }
  return hits;
}

// A wind-up is 0.4 s, 24 steps.
describe("attacking", () => {
  it("winds up for 0.4 s facing the Hero, then hits for 4–8 damage", () => {
    const damages: number[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      const w = world(["H.S."], seed);
      const [skeleton] = w.monsters;
      untilWindUp(w, skeleton);
      expect(skeleton.facing).toBeCloseTo(Math.PI);

      const hits = heroHits(w, 24);
      expect(hits.slice(0, 23).flat()).toEqual([]);
      expect(hits[23]).toEqual([
        {
          type: "HeroHit",
          damage: expect.any(Number),
          warded: 0,
          damageType: "physical",
        },
      ]);
      const [hit] = hits[23];
      if (hit.type !== "HeroHit") throw new Error();
      expect(w.hero.life).toBe(100 - hit.damage);
      damages.push(hit.damage);
    }

    for (const damage of damages) expect(Number.isInteger(damage)).toBe(true);
    expect(Math.min(...damages)).toBe(4);
    expect(Math.max(...damages)).toBe(8);
  });

  // The Skeleton winds up facing west, from (3.5, 2.5).
  it.each([
    { to: { x: 2.15, y: 2.5 }, hits: true, where: "1.35 away, ahead" },
    { to: { x: 2.4, y: 2.0 }, hits: true, where: "1.21 away, 24° off" },
    { to: { x: 1.95, y: 2.5 }, hits: false, where: "1.55 away" },
    { to: { x: 3.5, y: 1.6 }, hits: false, where: "0.9 away, 90° off" },
  ])("$where at the end of the wind-up: hits $hits", ({ to, hits }) => {
    const w = world([
      "......", //
      "......",
      "..HS..",
      "......",
    ]);
    const [skeleton] = w.monsters;
    untilWindUp(w, skeleton);

    const landed = heroHits(w, 24, [{ type: "MoveTo", target: to }]).flat();

    expect(w.hero.pos).toEqual(to);
    expect(landed.length).toBe(hits ? 1 : 0);
    expect(w.hero.life < 100).toBe(hits);
  });

  // Rooted 0.2 s is 12 steps; the wait after is 60 steps plus up to 24.
  it("is rooted 0.2 s after attacking, then waits 1.0–1.4 s to attack again", () => {
    const waits: number[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const w = world([".....H.S.."], seed);
      const [skeleton] = w.monsters;
      untilWindUp(w, skeleton);
      heroHits(w, 24);
      expect(skeleton.state).toBe("recover");

      // The Hero steps out of reach at once; the Skeleton follows only once
      // it is no longer rooted.
      const at = { ...skeleton.pos };
      step(w, [{ type: "MoveTo", target: { x: 4.5, y: 0.5 } }]);
      const rooted = track(w, skeleton, 10);
      for (const pos of rooted) expect(pos).toEqual(at);
      step(w, []);
      expect(skeleton.state).toBe("chase");
      expect(skeleton.pos.x).toBeLessThan(at.x);

      let wait = 0;
      while (skeleton.state !== "windup") {
        step(w, []);
        wait += 1;
      }
      waits.push(wait);
    }

    // Counted from the end of rooting.
    expect(Math.min(...waits)).toBe(60);
    expect(Math.max(...waits)).toBeGreaterThanOrEqual(80);
    expect(Math.max(...waits)).toBeLessThanOrEqual(84);
  });

  it("keeps winding up through a flinch", () => {
    let checked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const w = world(["HS.."], seed);
      const [skeleton] = w.monsters;
      untilWindUp(w, skeleton);
      // The Hero's hit lands 9 steps into the wind-up, and stops the sim
      // for 4 more.
      step(w, [{ type: "Attack", monster: skeleton.id }]);
      for (let i = 0; i < 8; i++) step(w, []);
      if (skeleton.flinch === 0) continue;
      checked += 1;

      expect(skeleton.state).toBe("windup");
      const hits = heroHits(w, 4 + 24 - 9);
      expect(hits.slice(0, -1).flat()).toEqual([]);
      expect(hits.at(-1)).toEqual([
        {
          type: "HeroHit",
          damage: expect.any(Number),
          warded: 0,
          damageType: "physical",
        },
      ]);
    }
    expect(checked).toBeGreaterThan(0);
  });
});

// A flinch is 0.15 s, 9 steps.
describe("the Hero hit", () => {
  const swingWest: Order = { type: "SwingAt", target: { x: 0.5, y: 1.5 } };

  it("flinches 25% of the time, cancelling an unlanded swing and running a click given meanwhile after it", () => {
    let flinched = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const w = world(["....", ".HS.", "...."], seed);
      const [skeleton] = w.monsters;
      untilWindUp(w, skeleton);
      stepTimes(w, 20);
      // 3 steps before the Skeleton's hit, well before the Hero's lands.
      step(w, [swingWest]);
      stepTimes(w, 2);
      const [hit] = heroHits(w, 1);
      expect(hit).toHaveLength(1);
      if (w.hero.flinch === 0) {
        expect(w.hero.swing?.elapsed).toBe(3);
        continue;
      }
      flinched += 1;
      expect(w.hero.swing).toBeNull();
      expect(w.hero.flinch).toBe(9);

      step(w, [swingWest]);
      stepTimes(w, 7);
      expect(w.hero.swing).toBeNull();
      step(w, []);
      expect(w.hero.flinch).toBe(0);
      expect(w.hero.swing).toMatchObject({
        elapsed: 0,
        landed: false,
        monster: null,
      });
    }

    expect(flinched).toBeGreaterThan(30);
    expect(flinched).toBeLessThan(75);
  });

  it("stops walking when it flinches", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = world([".....", ".HS..", "....."], seed);
      const [skeleton] = w.monsters;
      untilWindUp(w, skeleton);
      stepTimes(w, 22);
      // Walks 0.18 tiles before the hit and would walk on.
      step(w, [{ type: "MoveTo", target: { x: 1.5, y: 0.5 } }]);
      heroHits(w, 1);
      if (w.hero.flinch === 0) continue;

      const at = { ...w.hero.pos };
      stepTimes(w, 30);
      expect(w.hero.pos).toEqual(at);
      return;
    }
    throw new Error("Never flinched");
  });

  it("floors its Life at 0", () => {
    const w = world(["HS.."]);
    let damage = 0;
    for (let i = 0; i < 60 * 60; i++) {
      for (const event of step(w, [])) {
        if (event.type === "HeroHit") damage += event.damage;
      }
    }
    expect(damage).toBeGreaterThan(100);
    expect(w.hero.life).toBe(0);
  });
});
