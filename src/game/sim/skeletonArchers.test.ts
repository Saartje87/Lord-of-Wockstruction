import { afterEach, describe, expect, it } from "vitest";
import { monsterTuning } from "../tuning/monsters";
import { emptyBelt } from "./belt";
import type { Belongings } from "./inventory";
import {
  monsterAttackRating,
  monsterDamageRange,
  monsterDefense,
  monsterExperience,
  monsterMaxLife,
} from "./monsters";
import { combatArea } from "./testAreas";
import type { Vec } from "./vec";
import {
  createWorld,
  FRESH_PROGRESS,
  isInCombat,
  type Monster,
  type Order,
  type Progress,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start`, `N` an Entry named `arrive`, `E` an Exit to `exitTo`'s `arrive`,
 * `A` one Skeleton Archer and `S` one Skeleton, each in the middle of its
 * tile.
 */
function map(rows: string[], exitTo = "town") {
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
    if (cell === "N") objects.push({ name: "arrive", type: "entry", x, y });
    if (cell === "A") objects.push(spawn("skeleton_archer", x, y));
    if (cell === "S") objects.push(spawn("skeleton", x, y));
    if (cell === "E") {
      objects.push({
        name: "",
        type: "exit",
        x: x - 16,
        y: y - 16,
        width: 32,
        height: 32,
        properties: [
          { name: "area", type: "string", value: exitTo },
          { name: "entry", type: "string", value: "arrive" },
        ],
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

function world(
  rows: string[],
  seed = 1,
  belongings: Belongings | null = null,
): World {
  return createWorld({ areas: { town: map(rows) }, seed, belongings });
}

/**
 * A World with the Hero just arrived in a crypt of Area Level `areaLevel`,
 * a few tiles from one Skeleton Archer.
 */
function inCrypt(areaLevel: number, progress: Progress = FRESH_PROGRESS) {
  const w = createWorld({
    areas: {
      town: map(["HNE"], "crypt"),
      crypt: combatArea(map(["EN...A", ".....H"]), areaLevel),
    },
    seed: 1,
    progress,
  });
  for (let i = 0; w.areaName === "town"; i++) {
    if (i > 60 * 20) throw new Error("Never left Town");
    step(w, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
  }
  for (let i = 0; w.areaChange; i++) {
    if (i > 600) throw new Error("The Area change never ended");
    step(w, []);
  }
  return w;
}

/** Attacks the first Monster until it dies, returning the events. */
function killOne(world: World): SimEvent[] {
  const [target] = world.monsters;
  const all: SimEvent[] = [];
  for (let i = 0; world.monsters.includes(target); i++) {
    if (i > 60 * 120) throw new Error("The Archer never died");
    all.push(...step(world, [{ type: "Attack", monster: target.id }]));
  }
  return all;
}

const tunedGrowth = { ...monsterTuning.skeleton_archer.growth };
afterEach(() => {
  monsterTuning.skeleton_archer.growth = { ...tunedGrowth };
});

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
        equipment: { armour: { type: "leatherArmour" } },
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
    const from = { ...arrow.pos };

    const events = untilGone(w, arrow, [
      { type: "MoveTo", target: { x: 1.5, y: 3.5 } },
    ]);

    expect(onHero(events)).toEqual([]);
    // Gone on reaching the wall's tile, with range to spare.
    expect(arrow.pos.x).toBeLessThan(1);
    expect(arrow.pos.x).toBeGreaterThan(1 - 9 / 60 - 1e-9);
    expect(distance(from, arrow.pos)).toBeLessThan(10 - 3);
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

describe("an Archer behind its Skeletons", () => {
  it("looses Arrows that fly through a Skeleton standing between it and the Hero, and reach the Hero", () => {
    const w = world(["H...S..A.."]);
    const [skeleton, archer] = w.monsters;
    expect(skeleton.type).toBe("skeleton");
    expect(archer.type).toBe("skeleton_archer");

    const arrow = untilLoosed(w);
    let passed = false;
    while (w.projectiles.includes(arrow)) {
      if (distance(arrow.pos, skeleton.pos) < 0.32) passed = true;
      step(w, []);
    }

    expect(skeleton.pos.x).toBeLessThan(archer.pos.x);
    expect(passed).toBe(true);
    // Gone on touching the Hero, a body 0.3 tiles across.
    expect(distance(arrow.pos, w.hero.pos)).toBeLessThan(0.3 + 9 / 60);
  });

  it("joins when the Hero engages the Skeleton, standing further from it than the Skeleton wakes others", () => {
    // The Skeleton notices the Hero 6 tiles off; the Archer stands 3 tiles
    // behind it, twice the Skeleton's 1.5-tile spreadRadius, and 9 from the
    // Hero.
    const w = world(["H.....S..A"]);
    const [skeleton, archer] = w.monsters;
    const archerHome = { ...archer.pos };
    const skeletonHome = { ...skeleton.pos };

    // A second: a chase at 2.8 tiles/s, where a wander covers under one.
    for (let i = 0; i < 60; i++) step(w, []);

    expect(skeleton.pos.x).toBeLessThan(skeletonHome.x - 2);
    expect(archer.pos.x).toBeLessThan(archerHome.x - 2);
  });
});

describe("hitting a Skeleton Archer while it draws its bow", () => {
  it("cancels the shot about half the time, so no Arrow is loosed when the wind-up would have ended", () => {
    // Its 600 ms wind-up, and a little more for the hit's hitstop: well
    // short of a 200 ms flinch and a fresh wind-up.
    const windUpSteps = 36 + 6;
    let hits = 0;
    let cancelled = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const w = world(["HA.."], seed);
      const [archer] = w.monsters;
      untilWindUp(w, archer);

      let steps = 1;
      let events = step(w, [{ type: "Attack", monster: archer.id }]);
      for (; steps < 30 && !events.some((e) => e.type === "HitLanded"); ) {
        events = step(w, []);
        steps += 1;
      }
      if (!events.some((e) => e.type === "HitLanded")) continue;
      if (events.some((e) => e.type === "MonsterDied")) continue;
      // The hit lands before the wind-up would have ended.
      expect(w.projectiles).toEqual([]);
      hits += 1;

      for (; steps < windUpSteps && w.projectiles.length === 0; steps++) {
        step(w, []);
      }
      if (w.projectiles.length === 0) cancelled += 1;
    }

    expect(hits).toBeGreaterThan(50);
    expect(cancelled / hits).toBeGreaterThan(0.35);
    expect(cancelled / hits).toBeLessThan(0.65);
  });
});

describe("a Skeleton Archer's Monster Level", () => {
  it("grows its numbers by the Skeleton Archer's own rates", () => {
    monsterTuning.skeleton_archer.growth = {
      life: 0.5,
      damage: 1,
      attackRating: 0.25,
      defense: 0.1,
      experience: 2,
    };
    const [archer] = inCrypt(3).monsters;

    expect(archer.monsterLevel).toBe(3);
    expect(monsterMaxLife(archer)).toBe(72);
    expect(monsterDamageRange(archer)).toEqual([9, 18]);
    expect(monsterAttackRating(archer)).toBe(30);
    expect(monsterDefense(archer)).toBe(162);
    expect(monsterExperience(archer)).toBe(550);
  });

  it("gives the Skeleton Archer's Experience when one dies", () => {
    monsterTuning.skeleton_archer.growth.experience = 2;
    // Enough Vitality to outlast the Archer's Arrows.
    const w = inCrypt(3, { ...FRESH_PROGRESS, level: 3, vitality: 500 });

    const gained = killOne(w).filter((e) => e.type === "ExperienceGained");

    expect(gained).toEqual([{ type: "ExperienceGained", amount: 550 }]);
  });
});
