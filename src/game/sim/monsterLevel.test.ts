import { afterEach, describe, expect, it } from "vitest";
import { monsterTuning } from "../tuning/monsters";
import {
  type MonsterOfLevel,
  monsterAttackRating,
  monsterDamageRange,
  monsterDefense,
  monsterExperience,
  monsterMaxLife,
} from "./monsters";
import { combatArea } from "./testAreas";
import {
  createWorld,
  FRESH_PROGRESS,
  heroChanceToHit,
  levelExperience,
  monsterChanceToHit,
  type Progress,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area of open floor drawn row by row: `.` floor, `H` the
 * Hero's `start`, `S` a pack of `pack` Skeletons, `E` an Exit to the other
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
    if (cell === "S") {
      objects.push({
        name: "",
        type: "monsterSpawn",
        x,
        y,
        properties: [
          { name: "monster", type: "string", value: "skeleton" },
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

/**
 * A World with the Hero in Town, an Exit away from a crypt of Area Level
 * `areaLevel` holding a pack of `pack` Skeletons next to where they arrive.
 */
function world(
  areaLevel: number,
  { pack = 1, progress = FRESH_PROGRESS as Progress } = {},
): World {
  return createWorld({
    areas: {
      town: map(["HAE"], { exitTo: "crypt" }),
      crypt: map(["EA.S.", "....H"], { exitTo: "town", areaLevel, pack }),
    },
    seed: 1,
    progress,
  });
}

/** Steps until the Area change in progress, if any, is over. */
function settle(world: World) {
  for (let i = 0; world.areaChange; i++) {
    if (i > 600) throw new Error("The Area change never ended");
    step(world, []);
  }
}

/** Walks the Hero into the Exit at tile (x, y) and on into the next Area. */
function walkThrough(world: World, x: number, y: number) {
  const from = world.areaName;
  for (let i = 0; world.areaName === from; i++) {
    if (i > 60 * 20) throw new Error(`Never left "${from}"`);
    step(world, [{ type: "MoveTo", target: { x: x + 0.5, y: y + 0.5 } }]);
  }
  settle(world);
}

/** A World with the Hero just arrived in the crypt. */
function inCrypt(areaLevel: number, options: Parameters<typeof world>[1] = {}) {
  const w = world(areaLevel, options);
  walkThrough(w, 2, 0);
  expect(w.areaName).toBe("crypt");
  return w;
}

/** Attacks the crypt's first Monster until it dies, returning the events. */
function killOne(world: World): SimEvent[] {
  const [target] = world.monsters;
  const all: SimEvent[] = [];
  for (let i = 0; world.monsters.includes(target); i++) {
    if (i > 60 * 60) throw new Error("The Monster never died");
    all.push(...step(world, [{ type: "Attack", monster: target.id }]));
  }
  return all;
}

const skeletonAt = (monsterLevel: number): MonsterOfLevel => ({
  type: "skeleton",
  monsterLevel,
});

const tunedGrowth = { ...monsterTuning.skeleton.growth };
afterEach(() => {
  monsterTuning.skeleton.growth = { ...tunedGrowth };
});

describe("Monster Level", () => {
  it("is the Area Level of the Area every Monster spawns in", () => {
    monsterTuning.skeleton.growth.life = 0.5;
    const w = inCrypt(4, { pack: 3 });

    // 60 Life grown by half of itself for each of 3 Monster Levels above 1.
    expect(w.monsters.map(monsterMaxLife)).toEqual([150, 150, 150]);
  });

  it("is the Area Level again after leaving the Area and coming back", () => {
    monsterTuning.skeleton.growth.life = 0.5;
    const w = inCrypt(4, { pack: 3 });
    walkThrough(w, 0, 0);
    expect(w.areaName).toBe("town");
    walkThrough(w, 2, 0);

    expect(w.monsters.map(monsterMaxLife)).toEqual([150, 150, 150]);
  });

  it("makes a Monster Level 1 Skeleton today's Skeleton exactly", () => {
    const skeleton = skeletonAt(1);

    expect(monsterMaxLife(skeleton)).toBe(60);
    expect(monsterDamageRange(skeleton)).toEqual([4, 8]);
    expect(monsterAttackRating(skeleton)).toBe(20);
    expect(monsterDefense(skeleton)).toBe(135);
    expect(monsterExperience(skeleton)).toBe(100);
  });

  it("makes every scaled number higher at a higher Monster Level", () => {
    const low = skeletonAt(1);
    const high = skeletonAt(4);

    expect(monsterMaxLife(high)).toBeGreaterThan(monsterMaxLife(low));
    expect(monsterDamageRange(high)[0]).toBeGreaterThan(
      monsterDamageRange(low)[0],
    );
    expect(monsterDamageRange(high)[1]).toBeGreaterThan(
      monsterDamageRange(low)[1],
    );
    expect(monsterAttackRating(high)).toBeGreaterThan(monsterAttackRating(low));
    expect(monsterDefense(high)).toBeGreaterThan(monsterDefense(low));
    expect(monsterExperience(high)).toBeGreaterThan(monsterExperience(low));
  });

  it("grows each number by its own rate per Monster Level above 1", () => {
    monsterTuning.skeleton.growth = {
      life: 0.5,
      damage: 1,
      attackRating: 0.25,
      defense: 0.1,
      experience: 2,
    };
    const skeleton = skeletonAt(3);

    expect(monsterMaxLife(skeleton)).toBe(120);
    expect(monsterDamageRange(skeleton)).toEqual([12, 24]);
    expect(monsterAttackRating(skeleton)).toBe(30);
    expect(monsterDefense(skeleton)).toBe(162);
    expect(monsterExperience(skeleton)).toBe(500);
  });

  it("rounds each scaled number to a whole one", () => {
    monsterTuning.skeleton.growth = {
      life: 0.01,
      damage: 0.1,
      attackRating: 0.01,
      defense: 0.01,
      experience: 0.001,
    };
    const skeleton = skeletonAt(2);

    expect(monsterMaxLife(skeleton)).toBe(61);
    expect(monsterDamageRange(skeleton)).toEqual([4, 9]);
    expect(monsterAttackRating(skeleton)).toBe(20);
    expect(monsterDefense(skeleton)).toBe(136);
    expect(monsterExperience(skeleton)).toBe(100);
  });

  // Up to Level 12, well past the deepest Area Level. One rate can't follow
  // the whole table: from Level 11 each Level needs 25% more than the last.
  it("keeps kills per Level at 2–8 against Monsters of the Hero's own Level, up to Level 12", () => {
    for (let level = 1; level <= 12; level++) {
      const needed = levelExperience(level + 1) - levelExperience(level);
      const kills = needed / monsterExperience(skeletonAt(level));
      expect(kills, `kills for Level ${level + 1}`).toBeGreaterThanOrEqual(2);
      expect(kills, `kills for Level ${level + 1}`).toBeLessThanOrEqual(8);
    }
  });
});

describe("a Monster's scaled numbers in play", () => {
  it("spawn it at its scaled max Life", () => {
    monsterTuning.skeleton.growth.life = 0.5;
    const w = inCrypt(3);

    const dealt = killOne(w).flatMap((e) =>
      e.type === "HitLanded" ? [e.damage] : [],
    );
    const beforeLastHit = dealt.slice(0, -1).reduce((sum, d) => sum + d, 0);

    // It took 120 damage to kill: it lived through all but the last hit.
    expect(beforeLastHit).toBeLessThan(120);
    expect(beforeLastHit + (dealt.at(-1) ?? 0)).toBeGreaterThanOrEqual(120);
  });

  it("give its scaled Experience when it dies", () => {
    monsterTuning.skeleton.growth.experience = 2;
    const w = inCrypt(3);

    const gained = killOne(w).filter((e) => e.type === "ExperienceGained");

    expect(gained).toEqual([{ type: "ExperienceGained", amount: 500 }]);
  });

  it("hit the Hero for its scaled damage", () => {
    monsterTuning.skeleton.growth.damage = 1;
    // Enough Vitality to take a good few hits.
    const w = inCrypt(3, { progress: { ...FRESH_PROGRESS, vitality: 500 } });

    const damage: number[] = [];
    for (let i = 0; damage.length < 10; i++) {
      if (i > 60 * 60) throw new Error("The Hero was hardly hit");
      for (const event of step(w, [])) {
        if (event.type === "HeroHit") damage.push(event.damage);
      }
    }

    expect(Math.min(...damage)).toBeGreaterThanOrEqual(12);
    expect(Math.max(...damage)).toBeLessThanOrEqual(24);
  });

  it("set its scaled Defense against the Hero's chance to hit it", () => {
    monsterTuning.skeleton.growth.defense = 1;
    const w = world(1);

    // 100 Attack Rating against 135 Defense, then against 405.
    expect(heroChanceToHit(w, skeletonAt(1))).toBeCloseTo(0.851, 3);
    expect(heroChanceToHit(w, skeletonAt(3))).toBeCloseTo(0.396, 3);
  });

  it("set its scaled Attack Rating against the Hero's Defense", () => {
    monsterTuning.skeleton.growth.attackRating = 0.1;
    const w = createWorld({
      areas: { town: map(["H"]) },
      seed: 1,
      belongings: { inventory: [], equipment: { armour: "leatherArmour" } },
    });

    // 20 Attack Rating against Leather Armour's 27 Defense, then 24.
    expect(monsterChanceToHit(w, skeletonAt(1))).toBeCloseTo(0.851, 3);
    expect(monsterChanceToHit(w, skeletonAt(3))).toBeCloseTo(0.941, 3);
  });
});

describe("Experience drop-off", () => {
  /**
   * The Experience a Hero of Level `heroLevel` gains for killing a crypt
   * Skeleton of Monster Level `monsterLevel`, with the growth set so a
   * Skeleton at any Monster Level gives 100.
   */
  function experienceFor(heroLevel: number, monsterLevel: number) {
    monsterTuning.skeleton.growth.experience = 0;
    const w = inCrypt(monsterLevel, {
      progress: { ...FRESH_PROGRESS, level: heroLevel },
    });
    return killOne(w)
      .filter((e) => e.type === "ExperienceGained")
      .reduce((sum, e) => sum + e.amount, 0);
  }

  it("gives full Experience for a kill 0–5 Levels below the Hero", () => {
    for (let heroLevel = 2; heroLevel <= 7; heroLevel++) {
      expect(experienceFor(heroLevel, 2), `Hero Level ${heroLevel}`).toBe(100);
    }
  });

  it("falls steeply for a kill 6–9 Levels below the Hero", () => {
    const between = [6, 7, 8, 9, 10, 11].map((heroLevel) =>
      experienceFor(heroLevel, 1),
    );

    // From full at 5 below, every Level further below gives less, down to
    // about 5% at 10 below.
    for (let i = 1; i < between.length; i++) {
      expect(between[i], `${i + 5} Levels below`).toBeLessThan(between[i - 1]);
    }
    expect(between[0]).toBe(100);
    expect(between.at(-1)).toBe(5);
  });

  it("leaves about 5% of a kill 10 or more Levels below the Hero", () => {
    expect(experienceFor(11, 1)).toBe(5);
    expect(experienceFor(20, 1)).toBe(5);
  });

  it("gives full Experience, with no bonus, for a kill above the Hero's Level", () => {
    expect(experienceFor(1, 4)).toBe(100);
    expect(experienceFor(1, 8)).toBe(100);
  });
});
