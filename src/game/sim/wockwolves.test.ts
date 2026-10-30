import { describe, expect, it } from "vitest";
import {
  monsterDamageRange,
  monsterExperience,
  monsterMaxLife,
} from "./monsters";
import type { Vec } from "./vec";
import { createWorld, type SimEvent, step, type World } from "./world";

/**
 * An open orthogonal Area drawn row by row: `.` floor, `H` the Hero's `start`
 * and `W` a pack of `pack` Wockwolves, each in the middle of its tile.
 */
function map(rows: string[], pack: number) {
  const width = rows[0].length;
  const height = rows.length;
  const objects: object[] = [];
  [...rows.join("")].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") objects.push({ name: "start", type: "entry", x, y });
    if (cell === "W") {
      objects.push({
        name: "",
        type: "monsterSpawn",
        x,
        y,
        properties: [
          { name: "monster", type: "string", value: "wockwolf" },
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
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

function world(rows: string[], pack = 1): World {
  return createWorld({ areas: { town: map(rows, pack) }, seed: 1 });
}

function distance(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

describe("a Wockwolf", () => {
  it("chases at 6.0 tiles/s, faster than the Hero's 5.5", () => {
    const w = world(["H.....W..."]);
    const [wolf] = w.monsters;

    step(w, []);
    expect(wolf.state).toBe("chase");
    const a = { ...wolf.pos };
    step(w, []);
    expect(distance(a, wolf.pos)).toBeCloseTo(6 / 60);
    expect(wolf.pos.x).toBeLessThan(a.x);
  });

  it("catches a Hero walking away", () => {
    const w = world(["H.....W.................."]);
    const [wolf] = w.monsters;
    const away = { type: "MoveTo", target: { x: 24.5, y: 0.5 } } as const;
    step(w, [away]);
    const gap = distance(wolf.pos, w.hero.pos);

    for (let i = 0; i < 60; i++) step(w, [away]);

    // A second on, it has gained about half a tile on the Hero.
    expect(gap - distance(wolf.pos, w.hero.pos)).toBeGreaterThan(0.3);
  });

  it("winds up for 0.25 s, then hits for 2–5 damage", () => {
    const damages: number[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      const w = createWorld({
        areas: { town: map(["H.W."], 1) },
        seed,
      });
      const [wolf] = w.monsters;
      for (let i = 0; wolf.state !== "windup"; i++) {
        if (i > 60 * 10) throw new Error("It never wound up");
        step(w, []);
      }
      const hits: SimEvent[][] = [];
      for (let i = 0; i < 15; i++) {
        hits.push(step(w, []).filter((e) => e.type === "HeroHit"));
      }
      expect(hits.slice(0, 14).flat()).toEqual([]);
      const [hit] = hits[14];
      if (hit?.type !== "HeroHit") throw new Error("The Wockwolf didn't hit");
      damages.push(hit.damage);
    }

    expect(Math.min(...damages)).toBe(2);
    expect(Math.max(...damages)).toBe(5);
  });

  it("surrounds the Hero in a pack without overlapping", () => {
    const w = world(
      [
        "..........",
        "..........",
        "....H.....",
        "..........",
        "..........",
        "......W...",
      ],
      6,
    );

    for (let i = 0; i < 4 * 60; i++) step(w, []);

    expect(w.death).toBeNull();
    expect(w.monsters).toHaveLength(6);
    let nearest = Number.POSITIVE_INFINITY;
    for (const [i, a] of w.monsters.entries()) {
      expect(distance(a.pos, w.hero.pos)).toBeLessThan(2.5);
      for (const b of w.monsters.slice(i + 1)) {
        nearest = Math.min(nearest, distance(a.pos, b.pos));
      }
    }
    // Their radii are 0.3.
    expect(nearest).toBeGreaterThan(0.58);
  });
});

describe("a Wockwolf's numbers", () => {
  it("are 30 Life, 2–5 damage and 50 Experience at Monster Level 1", () => {
    const wolf = { type: "wockwolf", monsterLevel: 1 } as const;

    expect(monsterMaxLife(wolf)).toBe(30);
    expect(monsterDamageRange(wolf)).toEqual([2, 5]);
    expect(monsterExperience(wolf)).toBe(50);
  });

  it("grow per Monster Level at the Skeleton's rates", () => {
    const wolf = { type: "wockwolf", monsterLevel: 11 } as const;

    // The Skeleton's rates: 25% Life, 20% damage and 300% Experience of its
    // Monster Level 1 numbers a Level, for 10 Levels.
    expect(monsterMaxLife(wolf)).toBe(105);
    expect(monsterDamageRange(wolf)).toEqual([6, 15]);
    expect(monsterExperience(wolf)).toBe(1_550);
  });
});
