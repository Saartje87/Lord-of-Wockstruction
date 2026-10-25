import { describe, expect, it } from "vitest";
import type { Vec } from "./vec";
import {
  createWorld,
  isInCombat,
  isRegenerating,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area of open floor drawn row by row: `.` floor, `H` the
 * Hero's `start` and `S` one Skeleton, both in the middle of their tile.
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
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

function world(rows: string[], seed = 1): World {
  return createWorld({ areas: { town: map(rows) }, seed });
}

/** Steps with no orders until an event of `type` or `limit` steps pass. */
function stepUntil(world: World, type: SimEvent["type"], limit = 600) {
  for (let i = 0; i < limit; i++) {
    if (step(world, []).some((event) => event.type === type)) return;
  }
  throw new Error(`No ${type} in ${limit} steps`);
}

const isDamage = (event: SimEvent) =>
  event.type === "HitLanded" || event.type === "HeroHit";

/**
 * Runs the Hero round a circle of radius 4 about `centre` for one step,
 * staying ahead of a Skeleton chasing from inside it.
 */
function kite(world: World, centre: Vec): SimEvent[] {
  const { pos } = world.hero;
  const angle = Math.atan2(pos.y - centre.y, pos.x - centre.x) + 0.5;
  const target = {
    x: centre.x + 4 * Math.cos(angle),
    y: centre.y + 4 * Math.sin(angle),
  };
  return step(world, [{ type: "MoveTo", target }]);
}

// 5 s is 300 steps.
describe("In Combat", () => {
  it("holds while a Monster chases, even with no damage for over 5 s", () => {
    const w = world([
      ".............", //
      ".............",
      ".............",
      ".............",
      ".............",
      "......H......",
      "......S......",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ]);
    const [skeleton] = w.monsters;
    stepUntil(w, "HeroHit");
    const life = w.hero.life;
    expect(life).toBeLessThan(100);

    const centre = { x: 6.5, y: 6.5 };
    for (let i = 0; i < 8 * 60; i++) {
      expect(kite(w, centre).filter(isDamage)).toEqual([]);
      expect(isInCombat(w)).toBe(true);
    }

    expect(skeleton.state).toBe("chase");
    expect(w.hero.life).toBe(life);
  });

  it("starts with the Hero out of combat", () => {
    expect(isInCombat(world(["H.."]))).toBe(false);
  });
});

describe("regeneration", () => {
  it("starts 5 s after the last damage once no Monster chases, at 2 Life/s, capped at max", () => {
    const w = world(["H.S."]);
    const [skeleton] = w.monsters;
    stepUntil(w, "HeroHit");
    let died = false;
    while (!died) {
      const events = step(w, [{ type: "Attack", monster: skeleton.id }]);
      died = events.some((event) => event.type === "MonsterDied");
    }
    const life = w.hero.life;
    expect(life).toBeLessThan(100);

    for (let i = 1; i < 300; i++) {
      step(w, []);
      expect(isInCombat(w)).toBe(true);
      expect(w.hero.life).toBe(life);
    }
    step(w, []);
    expect(isInCombat(w)).toBe(false);
    expect(isRegenerating(w)).toBe(true);
    expect(w.hero.life).toBeCloseTo(life + 2 / 60);
    for (let i = 0; i < 60; i++) step(w, []);
    expect(w.hero.life).toBeCloseTo(life + 2 + 2 / 60);

    for (let i = 0; i < 60 * 60; i++) step(w, []);
    expect(w.hero.life).toBe(100);
    expect(isRegenerating(w)).toBe(false);
  });
});
