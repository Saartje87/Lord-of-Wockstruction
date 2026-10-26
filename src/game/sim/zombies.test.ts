import { afterEach, describe, expect, it } from "vitest";
import { monsterTuning } from "../tuning/monsters";
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
  type Monster,
  type Progress,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area of open floor drawn row by row: `.` floor, `H` the
 * Hero's `start`, `Z` a pack of `pack` Zombies, `E` an Exit to the other
 * Area's `start` and `A` an Entry named `arrive`, each in the middle of its
 * tile. A Combat Area has `areaLevel`; Town has none.
 */
function map(
  rows: string[],
  { pack = 1, exitTo = "", areaLevel = null as number | null } = {},
) {
  const width = rows[0].length;
  const height = rows.length;
  const objects: object[] = [];
  [...rows.join("")].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") objects.push({ name: "start", type: "entry", x, y });
    if (cell === "A") objects.push({ name: "arrive", type: "entry", x, y });
    if (cell === "Z") {
      objects.push({
        name: "",
        type: "monsterSpawn",
        x,
        y,
        properties: [
          { name: "monster", type: "string", value: "zombie" },
          { name: "count", type: "int", value: pack },
        ],
      });
    }
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
  const area = {
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
  return areaLevel === null ? area : combatArea(area, areaLevel);
}

/** A World with the Hero in Town, drawn as `rows`. */
function world(rows: string[], { seed = 1, pack = 1 } = {}): World {
  return createWorld({ areas: { town: map(rows, { pack }) }, seed });
}

/**
 * A World with the Hero just arrived in a crypt of Area Level `areaLevel`,
 * next to one Zombie.
 */
function inCrypt(areaLevel: number, progress: Progress = FRESH_PROGRESS) {
  const w = createWorld({
    areas: {
      town: map(["HAE"], { exitTo: "crypt" }),
      crypt: map(["EAZ..", "....H"], { exitTo: "town", areaLevel }),
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

function stepTimes(world: World, times: number) {
  for (let i = 0; i < times; i++) step(world, []);
}

function distance(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Steps until `zombie` starts winding up. */
function untilWindUp(world: World, zombie: Monster) {
  for (let i = 0; zombie.state !== "windup"; i++) {
    if (i > 60 * 10) throw new Error("It never wound up");
    step(world, []);
  }
}

/** Attacks the first Zombie until it dies, returning the events. */
function killOne(world: World): SimEvent[] {
  const [target] = world.monsters;
  const all: SimEvent[] = [];
  for (let i = 0; world.monsters.includes(target); i++) {
    if (i > 60 * 120) throw new Error("The Zombie never died");
    all.push(...step(world, [{ type: "Attack", monster: target.id }]));
  }
  return all;
}

const tunedGrowth = { ...monsterTuning.zombie.growth };
afterEach(() => {
  monsterTuning.zombie.growth = { ...tunedGrowth };
});

describe("a Zombie Spawn", () => {
  it("places that many Zombies, at the Zombie's Life", () => {
    const w = world(["H.......Z."], { pack: 3 });

    expect(w.monsters).toHaveLength(3);
    for (const monster of w.monsters) {
      expect(monster.type).toBe("zombie");
      expect(monster.life).toBe(150);
    }
  });
});

describe("a Zombie", () => {
  it("notices the Hero and chases at 1.4 tiles/s", () => {
    const w = world(["H.....Z..."]);
    const [zombie] = w.monsters;

    step(w, []);
    expect(zombie.state).toBe("chase");
    const a = { ...zombie.pos };
    step(w, []);
    expect(distance(a, zombie.pos)).toBeCloseTo(1.4 / 60);
    expect(zombie.pos.x).toBeLessThan(a.x);
  });

  // A wind-up of 0.75 s is 45 steps.
  it("winds up for 0.75 s, then hits for 7–14 damage", () => {
    const damages: number[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      const w = world(["H.Z."], { seed });
      const [zombie] = w.monsters;
      untilWindUp(w, zombie);

      const hits: SimEvent[][] = [];
      for (let i = 0; i < 45; i++) {
        hits.push(step(w, []).filter((e) => e.type === "HeroHit"));
      }
      expect(hits.slice(0, 44).flat()).toEqual([]);
      const [hit] = hits[44];
      if (hit?.type !== "HeroHit") throw new Error("The Zombie didn't hit");
      damages.push(hit.damage);
    }

    expect(Math.min(...damages)).toBe(7);
    expect(Math.max(...damages)).toBe(14);
  });

  it("flinches about 10% of the time it is hit", () => {
    let flinched = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const w = world(["HZ.."], { seed });
      const [zombie] = w.monsters;
      step(w, [{ type: "Attack", monster: zombie.id }]);
      stepTimes(w, 8);
      if (zombie.flinch > 0) flinched += 1;
    }

    expect(flinched).toBeGreaterThan(8);
    expect(flinched).toBeLessThan(35);
  });
});

describe("a Zombie's Monster Level", () => {
  it("grows its numbers by the Zombie's own rates", () => {
    monsterTuning.zombie.growth = {
      life: 0.5,
      damage: 1,
      attackRating: 0.25,
      defense: 0.1,
      experience: 2,
    };
    const [zombie] = inCrypt(3).monsters;

    expect(zombie.monsterLevel).toBe(3);
    expect(monsterMaxLife(zombie)).toBe(300);
    expect(monsterDamageRange(zombie)).toEqual([21, 42]);
    expect(monsterAttackRating(zombie)).toBe(38);
    expect(monsterDefense(zombie)).toBe(144);
    expect(monsterExperience(zombie)).toBe(875);
  });

  it("gives the Zombie's Experience when one dies", () => {
    monsterTuning.zombie.growth.experience = 2;
    // Enough Vitality to outlast the Zombie.
    const w = inCrypt(3, { ...FRESH_PROGRESS, level: 3, vitality: 500 });

    const gained = killOne(w).filter((e) => e.type === "ExperienceGained");

    expect(gained).toEqual([{ type: "ExperienceGained", amount: 875 }]);
  });
});
