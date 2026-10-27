import { describe, expect, it } from "vitest";
import {
  createWorld,
  type Order,
  type SimEvent,
  step,
  type World,
} from "./world";

/** A `monsterSpawn` object at a point in tile units, on 32 px tiles. */
function spawn(x: number, y: number, count: number, monster = "skeleton") {
  return {
    name: "",
    type: "monsterSpawn",
    point: true,
    x: x * 32,
    y: y * 32,
    properties: [
      { name: "monster", type: "string", value: monster },
      { name: "count", type: "int", value: count },
    ],
  };
}

/**
 * A 10×10 orthogonal Area of open floor with `start` in the middle of
 * (1, 1), and the given objects.
 */
function arena(objects: object[]) {
  return {
    orientation: "orthogonal",
    width: 10,
    height: 10,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 10,
        height: 10,
        data: new Array(100).fill(1),
      },
      {
        type: "objectgroup",
        name: "objects",
        objects: [
          { name: "start", type: "entry", point: true, x: 48, y: 48 },
          ...objects,
        ],
      },
    ],
  };
}

describe("monsterSpawn", () => {
  it("places that many idle Skeletons around it with stable ids", () => {
    const world = createWorld({
      areas: { town: arena([spawn(5, 5, 3), spawn(8, 2, 1)]) },
      seed: 1,
    });

    expect(world.monsters.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    for (const monster of world.monsters) {
      expect(monster.type).toBe("skeleton");
      expect(monster.life).toBe(60);
    }
    for (const monster of world.monsters.slice(0, 3)) {
      const { x, y } = monster.pos;
      expect(Math.hypot(x - 5, y - 5)).toBeLessThan(1.5);
    }
    expect(world.monsters[3].pos).toEqual({ x: 8, y: 2 });
  });

  it("keeps a pack's Skeletons apart", () => {
    const world = createWorld({
      areas: { town: arena([spawn(5, 5, 7)]) },
      seed: 1,
    });

    const [first, ...rest] = world.monsters;
    for (const other of rest) {
      for (const monster of [first, ...rest]) {
        if (monster === other) continue;
        const gap = Math.hypot(
          monster.pos.x - other.pos.x,
          monster.pos.y - other.pos.y,
        );
        expect(gap).toBeGreaterThanOrEqual(0.64);
      }
    }
  });

  it("throws naming the Area for an unknown monster", () => {
    expect(() =>
      createWorld({
        areas: { town: arena([spawn(5, 5, 1, "dragon")]) },
        seed: 1,
      }),
    ).toThrow('Area "town" spawns unknown monster "dragon"');
  });
});

/**
 * Steps the World `times` times with no orders, returning each step's events
 * in order.
 */
function stepTimes(world: World, times: number): SimEvent[][] {
  const events: SimEvent[][] = [];
  for (let i = 0; i < times; i++) events.push(step(world, []));
  return events;
}

/** A World with the Hero at (1.5, 1.5) and Skeletons at `at`, one each. */
function withSkeletons(at: [number, number][], seed = 1) {
  return createWorld({
    areas: { town: arena(at.map(([x, y]) => spawn(x, y, 1))) },
    seed,
  });
}

const swingAt = (x: number, y: number): Order => ({
  type: "SwingAt",
  target: { x, y },
});
const attack = (monster: number): Order => ({ type: "Attack", monster });
const moveTo = (x: number, y: number): Order => ({
  type: "MoveTo",
  target: { x, y },
});

// A swing is 0.35 s, 21 steps, counted from the step its order arrives on.
describe("swinging", () => {
  it("swings in place towards the point and ends after 0.35 s", () => {
    const world = withSkeletons([]);

    step(world, [swingAt(3.5, 1.5)]);
    expect(world.hero.swing).not.toBeNull();
    expect(world.hero.facing).toBeCloseTo(0);

    stepTimes(world, 20);
    expect(world.hero.swing).not.toBeNull();
    step(world, []);
    expect(world.hero.swing).toBeNull();
    expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });
  });

  // 140 ms is 8.4 steps, so 8.
  it("lands the hit on the step at 140 ms of the swing", () => {
    const world = withSkeletons([[2.5, 1.5]]);

    step(world, [attack(1)]);
    const events = stepTimes(world, 8);

    expect(events.slice(0, 7).flat()).toEqual([]);
    expect(events[7]).toEqual([
      {
        type: "HitLanded",
        attacker: "hero",
        target: 1,
        damage: expect.any(Number),
      },
    ]);
  });
});

describe("orders during a swing", () => {
  it("buffers an Attack and fires it on the step the swing ends, newest wins", () => {
    const world = withSkeletons([
      [1.5, 2.3],
      [2.3, 1.5],
    ]);
    step(world, [swingAt(1.5, 0.5)]);
    stepTimes(world, 2);
    step(world, [attack(1)]);
    step(world, [attack(2)]);
    stepTimes(world, 16);
    expect(world.hero.swing?.monster).toBeNull();

    step(world, []);

    expect(world.hero.swing).toEqual({
      elapsed: 0,
      landed: false,
      monster: 2,
    });
    expect(world.hero.facing).toBeCloseTo(0);
  });

  it("doesn't let a MoveTo cancel the swing before its hit lands", () => {
    const world = withSkeletons([]);
    step(world, [swingAt(1.5, 0.5)]);
    stepTimes(world, 2);
    step(world, [moveTo(5.5, 1.5)]);
    stepTimes(world, 17);
    expect(world.hero.swing).not.toBeNull();
    expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });

    step(world, []);

    expect(world.hero.swing).toBeNull();
    expect(world.hero.pos.x).toBeGreaterThan(1.5);
  });

  it("drops the buffered order when a MoveTo cancels the swing", () => {
    const world = withSkeletons([[1.5, 2.3]]);
    step(world, [swingAt(1.5, 0.5)]);
    step(world, [attack(1)]);
    stepTimes(world, 7);

    step(world, [moveTo(1.5, 1.6)]);
    stepTimes(world, 5);
    step(world, [swingAt(1.5, 0.5)]);
    stepTimes(world, 60);

    expect(world.hero.swing).toBeNull();
    expect(world.monsters[0].life).toBe(60);
  });

  it("lets a MoveTo cancel the swing once its hit has landed", () => {
    const world = withSkeletons([]);
    step(world, [swingAt(1.5, 0.5)]);
    stepTimes(world, 8);

    step(world, [moveTo(5.5, 1.5)]);

    expect(world.hero.swing).toBeNull();
    expect(world.hero.pos.x).toBeGreaterThan(1.5);
  });
});

// 60 ms is 3.6 steps, so 4.
describe("hitstop", () => {
  it("pauses the swing for 4 steps after its hit lands", () => {
    const world = withSkeletons([[2.5, 1.5]]);
    step(world, [attack(1)]);
    stepTimes(world, 8);

    stepTimes(world, 16);
    expect(world.hero.swing).not.toBeNull();
    step(world, []);
    expect(world.hero.swing).toBeNull();
  });

  it("holds the whole simulation still, orders included, then resumes", () => {
    const world = withSkeletons([[2.5, 1.5]]);
    step(world, [attack(1)]);
    stepTimes(world, 8);
    const skeleton = world.monsters[0];
    const flinch = skeleton.flinch;

    step(world, [moveTo(1.5, 5.5)]);
    stepTimes(world, 3);
    expect(world.hero.swing).toEqual({ elapsed: 8, landed: true, monster: 1 });
    expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });
    expect(skeleton.flinch).toBe(flinch);

    step(world, []);
    expect(world.hero.swing).toBeNull();
    expect(world.hero.pos.y).toBeGreaterThan(1.5);
  });

  // A walk in a direction is for its own step: kept through the hitstop, the
  // Hero would leap the 4 steps at once as it ends.
  it("drops a Walk given during it, which walks no faster after", () => {
    const world = withSkeletons([[2.5, 1.5]]);
    step(world, [attack(1)]);
    stepTimes(world, 8);
    const walk: Order = { type: "Walk", direction: { x: 0, y: 1 } };

    for (let i = 0; i < 4; i++) step(world, [walk]);
    expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });
    step(world, [walk]);

    expect(world.hero.pos.y).toBeCloseTo(1.5 + 5.5 / 60);
  });
});

describe("SwingAt", () => {
  it("hits every Monster in reach within 50° of the facing", () => {
    const world = withSkeletons([
      [2.3, 1.5], // ahead
      [2.1, 2.2], // 49° off, 0.92 away
      [1.5, 2.4], // 90° off
      [0.8, 1.5], // behind
      [2.7, 1.5], // 1.2 away
    ]);
    step(world, [swingAt(3.5, 1.5)]);

    const hits = stepTimes(world, 8)
      .flat()
      .filter((event) => event.type === "HitLanded");

    expect(hits.map((event) => event.target)).toEqual([1, 2]);
  });

  it("lands without hitstop when the arc is empty", () => {
    const world = withSkeletons([[0.8, 1.5]]);
    step(world, [swingAt(3.5, 1.5)]);

    expect(stepTimes(world, 21).flat()).toEqual([]);
    expect(world.hero.swing).toBeNull();
  });
});

/**
 * Attacks Skeleton `id` every step until it dies or `limit` steps pass,
 * returning every event in order.
 */
function fight(world: World, id: number, limit = 600): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < limit; i++) {
    events.push(...step(world, [attack(id)]));
    if (events.some((event) => event.type === "MonsterDied")) break;
  }
  return events;
}

describe("Attack", () => {
  it("walks into reach of the Skeleton and swings at it", () => {
    const world = withSkeletons([[5.5, 1.5]]);
    const [skeleton] = world.monsters;
    step(world, [attack(1)]);
    while (!world.hero.swing) step(world, []);

    // It comes to meet the Hero.
    const { x, y } = world.hero.pos;
    const gap = Math.hypot(skeleton.pos.x - x, skeleton.pos.y - y);
    expect(gap).toBeLessThanOrEqual(1);
    expect(gap).toBeGreaterThan(0.9);
    expect(stepTimes(world, 8)[7]).toContainEqual(
      expect.objectContaining({ type: "HitLanded", target: 1 }),
    );
  });

  it("deals 20–30 damage a hit, replaying identically from a seed", () => {
    const damages: number[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      const events = fight(withSkeletons([[2.5, 1.5]], seed), 1);
      expect(fight(withSkeletons([[2.5, 1.5]], seed), 1)).toEqual(events);
      for (const event of events) {
        if (event.type === "HitLanded") damages.push(event.damage);
      }
    }

    for (const damage of damages) expect(Number.isInteger(damage)).toBe(true);
    expect(Math.min(...damages)).toBe(20);
    expect(Math.max(...damages)).toBe(30);
  });

  it("rolls differently from different seeds", () => {
    const first = fight(withSkeletons([[2.5, 1.5]], 1), 1);
    const second = fight(withSkeletons([[2.5, 1.5]], 2), 1);

    expect(second).not.toEqual(first);
  });
});

describe("hit Skeletons", () => {
  // 200 ms is 12 steps; hitstop doesn't count.
  it("flinch 35% of the time for 0.2 s", () => {
    let flinched = 0;
    let checked = false;
    for (let seed = 1; seed <= 100; seed++) {
      const world = withSkeletons([[2.5, 1.5]], seed);
      step(world, [attack(1)]);
      stepTimes(world, 8);
      const [skeleton] = world.monsters;
      if (skeleton.flinch === 0) continue;
      flinched += 1;
      if (checked) continue;

      expect(skeleton.flinch).toBe(12);
      stepTimes(world, 4 + 11);
      expect(skeleton.flinch).toBe(1);
      step(world, []);
      expect(skeleton.flinch).toBe(0);
      checked = true;
    }

    expect(flinched).toBeGreaterThan(20);
    expect(flinched).toBeLessThan(50);
  });

  it("die at 0 Life, leaving an inert Corpse where they stood", () => {
    const world = withSkeletons([
      [2.5, 1.5],
      [2.5, 2.5],
    ]);

    const events = fight(world, 1);

    const hits = events.filter((event) => event.type === "HitLanded");
    const total = hits.reduce((sum, event) => sum + event.damage, 0);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.length).toBeLessThanOrEqual(3);
    expect(total).toBeGreaterThanOrEqual(60);
    // The other Skeleton may hit the Hero on the same step.
    expect(events).toContainEqual({ type: "MonsterDied", id: 1 });
    expect(world.monsters.map((m) => m.id)).toEqual([2]);
    expect(world.corpses).toEqual([
      { id: 1, type: "skeleton", monsterLevel: 1, pos: { x: 2.5, y: 1.5 } },
    ]);
  });

  it("ignore an Attack on a Corpse", () => {
    const world = withSkeletons([[2.5, 1.5]]);
    fight(world, 1);
    stepTimes(world, 60);

    step(world, [attack(1)]);
    stepTimes(world, 30);

    expect(world.hero.swing).toBeNull();
    expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });
  });
});
