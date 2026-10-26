import { describe, expect, it } from "vitest";
import { emptyBelt } from "./belt";
import type { Belongings } from "./inventory";
import type { Vec } from "./vec";
import {
  createWorld,
  isInCombat,
  type Monster,
  type Order,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start`, `A` one Skeleton Archer and `S` one Skeleton, each in the middle
 * of its tile.
 */
function map(rows: string[]) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const objects: object[] = [];
  const spawn = (monster: string, x: number, y: number) => ({
    name: "",
    type: "monsterSpawn",
    point: true,
    x,
    y,
    properties: [{ name: "monster", type: "string", value: monster }],
  });
  [...cells].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") {
      objects.push({ name: "start", type: "entry", point: true, x, y });
    }
    if (cell === "A") objects.push(spawn("skeleton_archer", x, y));
    if (cell === "S") objects.push(spawn("skeleton", x, y));
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

function world(
  rows: string[],
  seed = 1,
  belongings: Belongings | null = null,
): World {
  return createWorld({ areas: { town: map(rows) }, seed, belongings });
}

/** Steps until the first Arrow is loosed, returning it. */
function untilLoosed(world: World) {
  for (let i = 0; world.projectiles.length === 0; i++) {
    if (i > 60 * 10) throw new Error("No Arrow was loosed");
    step(world, []);
  }
  return world.projectiles[0];
}

/** Steps until `arrow` is gone, returning the events of the step it went. */
function untilGone(world: World, arrow: object, orders: Order[] = []) {
  for (let i = 0; i < 60 * 5; i++) {
    const events = step(world, i === 0 ? orders : []);
    if (!world.projectiles.some((p) => p === arrow)) return events;
  }
  throw new Error("The Arrow never went");
}

/** The events of an attack on the Hero landing or failing to. */
function onHero(events: SimEvent[]): SimEvent[] {
  return events.filter(
    (event) =>
      event.type === "HeroHit" ||
      (event.type === "Missed" && event.target === "hero"),
  );
}

function distance(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Steps until `archer` starts winding up, giving `orders` each step. */
function untilWindUp(
  world: World,
  archer: Monster,
  orders: Order[] = [],
): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; archer.state !== "windup"; i++) {
    if (i > 60 * 10) throw new Error("It never wound up");
    events.push(...step(world, orders));
  }
  return events;
}

describe("a Skeleton Archer", () => {
  it("stops once the Hero is within its 6 tiles' range and in sight, and winds up", () => {
    const w = world(["H......A.."]);
    const [archer] = w.monsters;
    const home = { ...archer.pos };

    untilWindUp(w, archer);

    expect(distance(archer.pos, home)).toBeGreaterThan(0.5);
    expect(distance(archer.pos, w.hero.pos)).toBeLessThanOrEqual(6 + 1e-9);
    expect(distance(archer.pos, w.hero.pos)).toBeGreaterThan(5.9);
  });

  it("walks on, in range but with a wall in the way, until it can see the Hero", () => {
    // The Skeleton sees the Hero and wakes the Archer, which can't.
    const w = world([
      "..........", //
      "H....#A...",
      "......S...",
    ]);
    const archer = w.monsters.find((m) => m.type === "skeleton_archer");
    if (!archer) throw new Error("No Archer");
    const home = { ...archer.pos };
    expect(distance(home, w.hero.pos)).toBeLessThanOrEqual(6);

    untilWindUp(w, archer);

    expect(distance(archer.pos, home)).toBeGreaterThan(0.4);
    // Off the row the wall stands in.
    expect(Math.abs(archer.pos.y - 1.5)).toBeGreaterThan(0.4);
  });

  it("looses an Arrow at the end of its wind-up, at where the Hero is then", () => {
    const w = world([
      "H......A..", //
      "..........",
      "..........",
      "..........",
    ]);
    const [archer] = w.monsters;
    untilWindUp(w, archer);

    // The Hero walks off during the wind-up.
    const moveAway: Order = { type: "MoveTo", target: { x: 0.5, y: 3.5 } };
    for (let i = 0; archer.state === "windup"; i++) {
      if (i > 60) throw new Error("The wind-up never ended");
      expect(w.projectiles).toEqual([]);
      step(w, i === 0 ? [moveAway] : []);
    }

    expect(w.projectiles).toHaveLength(1);
    const [arrow] = w.projectiles;
    const toHero = {
      x: w.hero.pos.x - archer.pos.x,
      y: w.hero.pos.y - archer.pos.y,
    };
    const gap = Math.hypot(toHero.x, toHero.y);
    expect(arrow.direction.x).toBeCloseTo(toHero.x / gap);
    expect(arrow.direction.y).toBeCloseTo(toHero.y / gap);
  });

  it("looses an Arrow that flies to the Hero at 9 tiles/s, hitting them only on arrival", () => {
    const w = world(["H......A.."]);
    const [archer] = w.monsters;
    untilWindUp(w, archer);
    const hits: SimEvent[] = [];
    while (w.projectiles.length === 0) hits.push(...step(w, []));
    const [arrow] = w.projectiles;
    const gap = distance(arrow.pos, w.hero.pos);
    expect(hits.filter((e) => e.type === "HeroHit")).toEqual([]);

    let steps = 0;
    let at = { ...arrow.pos };
    while (w.projectiles.includes(arrow)) {
      if (steps > 60 * 5) throw new Error("The Arrow never landed");
      const events = step(w, []);
      steps += 1;
      if (w.projectiles.includes(arrow)) {
        expect(distance(at, arrow.pos)).toBeCloseTo(9 / 60);
        at = { ...arrow.pos };
        expect(events.filter((e) => e.type === "HeroHit")).toEqual([]);
      } else {
        expect(events.filter((e) => e.type === "HeroHit")).toHaveLength(1);
      }
    }
    // It lands once it touches the Hero, a body 0.3 tiles across.
    expect(steps).toBeGreaterThan(((gap - 0.5) / 9) * 60);
    expect(steps).toBeLessThan((gap / 9) * 60 + 2);
  });

  it("keeps shooting with the Hero right next to it, and never swings", () => {
    const w = world(["HA........"]);
    const loosed = new Set<object>();
    let hits = 0;

    for (let i = 0; i < 60 * 6; i++) {
      const before = [...w.projectiles];
      const events = step(w, []);
      for (const projectile of w.projectiles) loosed.add(projectile);
      const landed = before.filter((p) => !w.projectiles.includes(p));
      const heroHits = events.filter((e) => e.type === "HeroHit");
      // Every hit on the Hero is an Arrow landing.
      expect(heroHits.length).toBeLessThanOrEqual(landed.length);
      hits += heroHits.length;
    }

    expect(loosed.size).toBeGreaterThanOrEqual(2);
    expect(hits).toBeGreaterThanOrEqual(2);
  });
});

describe("an Arrow", () => {
  it("misses a Hero who steps aside while it flies", () => {
    const w = world([
      "H......A..", //
      "..........",
      "..........",
      "..........",
    ]);
    const life = w.hero.life;
    const arrow = untilLoosed(w);

    const events = untilGone(w, arrow, [
      { type: "MoveTo", target: { x: 0.5, y: 3.5 } },
    ]);

    expect(onHero(events)).toEqual([]);
    expect(w.hero.life).toBe(life);
  });

  it("hits or misses a Hero who stands still by Attack Rating against Defense, like a swing", () => {
    // 20 Attack Rating against Leather Armour's 27 Defense hits 85% of the time.
    let missed = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const w = world(["H......A.."], seed, {
        inventory: [],
        equipment: { armour: "leatherArmour" },
        belt: emptyBelt(),
      });
      const life = w.hero.life;
      const arrow = untilLoosed(w);

      const [event, ...rest] = onHero(untilGone(w, arrow));

      expect(rest).toEqual([]);
      if (event?.type === "Missed") {
        missed += 1;
        expect(w.hero.life).toBe(life);
      } else if (event?.type === "HeroHit") {
        expect(event.damage).toBeGreaterThanOrEqual(3);
        expect(event.damage).toBeLessThanOrEqual(6);
        expect(w.hero.life).toBe(life - event.damage);
        expect(isInCombat(w)).toBe(true);
      } else {
        throw new Error("The Arrow neither hit nor missed");
      }
    }

    expect(missed).toBeGreaterThan(5);
    expect(missed).toBeLessThan(28);
  });

  it("vanishes at a wall", () => {
    const w = world([
      "#H......A..", //
      "#..........",
      "#..........",
      "#..........",
    ]);
    const arrow = untilLoosed(w);

    const events = untilGone(w, arrow, [
      { type: "MoveTo", target: { x: 1.5, y: 3.5 } },
    ]);

    expect(onHero(events)).toEqual([]);
    // Gone on reaching the wall's tile, with range to spare.
    expect(arrow.pos.x).toBeLessThan(1);
    expect(arrow.pos.x).toBeGreaterThan(1 - 9 / 60 - 1e-9);
    expect(arrow.left).toBeGreaterThan(3);
  });

  it("vanishes after flying its 10 tiles' range", () => {
    const w = world([
      "..........H......A..", //
      "....................",
      "....................",
      "....................",
    ]);
    const arrow = untilLoosed(w);
    const from = { ...arrow.pos };

    untilGone(w, arrow, [{ type: "MoveTo", target: { x: 10.5, y: 3.5 } }]);

    expect(distance(from, arrow.pos)).toBeCloseTo(10);
    expect(arrow.pos.x).toBeGreaterThan(5);
  });
});
