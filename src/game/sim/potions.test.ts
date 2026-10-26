import { afterEach, describe, expect, it } from "vitest";
import { beltTuning } from "../tuning/items";
import { beltOf } from "./belt";
import { type Belongings, FRESH_BELONGINGS } from "./inventory";
import { combatArea } from "./testAreas";
import {
  createWorld,
  maxLife,
  maxMana,
  potionEffectsOf,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area of open floor drawn row by row: `.` floor, `H` the
 * Hero's `start` and `S` a pack of `pack` Skeletons, centred on their tile.
 * `objects` adds more, such as Entries and Exits.
 */
function map(rows: string[], objects: object[] = [], pack = 1) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const all = [...objects];
  [...cells].forEach((cell, i) => {
    const x = i % width;
    const y = Math.floor(i / width);
    if (cell === "H") all.push(entry("start", x, y));
    if (cell === "S") {
      all.push({
        name: "",
        type: "monsterSpawn",
        point: true,
        x: (x + 0.5) * 32,
        y: (y + 0.5) * 32,
        properties: [
          { name: "monster", type: "string", value: "skeleton" },
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
      { type: "objectgroup", name: "objects", objects: all },
    ],
  };
}

/** An Entry in the middle of tile (x, y). */
function entry(name: string, x: number, y: number) {
  return {
    name,
    type: "entry",
    point: true,
    x: (x + 0.5) * 32,
    y: (y + 0.5) * 32,
  };
}

/** An Exit covering tile (x, y), to an Entry in another Area. */
function exit(x: number, y: number, area: string, toEntry: string) {
  return {
    name: "",
    type: "exit",
    x: x * 32,
    y: y * 32,
    width: 32,
    height: 32,
    properties: [
      { name: "area", type: "string", value: area },
      { name: "entry", type: "string", value: toEntry },
    ],
  };
}

const town = map(["H..."]);

/** A Town whose Hero starts with `belongings`, or a New Hero's. */
function inTown(belongings?: Belongings): World {
  return createWorld({ areas: { town }, seed: 1, belongings });
}

/**
 * A World with the Hero just arrived in a cave with a pack of `pack`
 * Skeletons standing near them.
 */
function inCave(pack: number, seed = 1): World {
  const withExit = map(["H..."], [exit(3, 0, "cave", "from-town")]);
  const cave = combatArea(
    map(
      [
        "..........", //
        ".H........",
        "..........",
        "....S.....",
        "..........",
      ],
      [entry("from-town", 2, 3)],
      pack,
    ),
  );
  const w = createWorld({ areas: { town: withExit, cave }, seed });
  step(w, [{ type: "MoveTo", target: { x: 3.5, y: 0.5 } }]);
  while (w.areaName !== "cave" || w.areaChange !== null) step(w, []);
  return w;
}

/** Steps with no orders until an event of `type`, failing after `limit`. */
function stepUntil(world: World, type: SimEvent["type"], limit = 60 * 60) {
  for (let i = 0; i < limit; i++) {
    const found = step(world, []).find((event) => event.type === type);
    if (found) return found;
  }
  throw new Error(`No ${type} in ${limit} steps`);
}

/** Steps `count` times with no orders. */
function wait(world: World, count: number) {
  for (let i = 0; i < count; i++) step(world, []);
}

/** The Belt Columns by Potion type, each from the bottom up. */
const beltTypes = (world: World) =>
  beltOf(world).map((column) => column.map((item) => item.type));

const drink = (column: number) => ({ type: "DrinkFromBelt" as const, column });

const LIFE = "lifePotion" as const;
const MANA = "manaPotion" as const;
const REJUVENATION = "rejuvenationPotion" as const;

/** A Town whose Hero has `belt` in their Belt Columns. */
const withBelt = (belt: Belongings["belt"]) =>
  inTown({ ...FRESH_BELONGINGS, belt });

afterEach(() => {
  beltTuning.rowsWithoutBelt = 1;
});

describe("a New Hero's Belt", () => {
  it("holds a Life Potion in each of the four Belt Columns", () => {
    expect(beltTypes(inTown())).toEqual([[LIFE], [LIFE], [LIFE], [LIFE]]);
  });

  it("is part of a New Hero's Belongings", () => {
    expect(FRESH_BELONGINGS.belt).toEqual([[LIFE], [LIFE], [LIFE], [LIFE]]);
  });
});

describe("drinking from a Belt Column", () => {
  it("uses up the bottom Potion, reporting it and the Belt changing", () => {
    const w = inTown();
    const [bottom] = beltOf(w)[2];

    const events = step(w, [drink(2)]);

    expect(events).toEqual([
      { type: "PotionDrunk", item: bottom },
      { type: "BeltChanged" },
    ]);
    expect(beltTypes(w)).toEqual([[LIFE], [LIFE], [], [LIFE]]);
  });

  it("drops the Potions above down a row", () => {
    beltTuning.rowsWithoutBelt = 3;
    const w = inTown({
      ...FRESH_BELONGINGS,
      belt: [[LIFE, LIFE, LIFE], [], [LIFE], []],
    });
    const [, second, third] = beltOf(w)[0];

    step(w, [drink(0)]);

    expect(beltOf(w)[0]).toEqual([second, third]);
  });

  it("does nothing from an empty Belt Column", () => {
    const w = inTown();
    step(w, [drink(1)]);

    expect(step(w, [drink(1)])).toEqual([]);
    expect(beltTypes(w)).toEqual([[LIFE], [], [LIFE], [LIFE]]);
  });

  it("does nothing for a Belt Column that doesn't exist", () => {
    const w = inTown();

    expect(step(w, [drink(4)])).toEqual([]);
    expect(step(w, [drink(-1)])).toEqual([]);
    expect(beltTypes(w)).toEqual([[LIFE], [LIFE], [LIFE], [LIFE]]);
  });

  it("works in Town", () => {
    const w = inTown();
    w.hero.life = 50;

    step(w, [drink(0)]);
    wait(w, 4 * 60);

    expect(w.hero.life).toBeGreaterThanOrEqual(80);
  });

  it("at full Life still uses the Potion up", () => {
    const w = inTown();

    step(w, [drink(0)]);
    wait(w, 4 * 60);

    expect(beltTypes(w)[0]).toEqual([]);
    expect(w.hero.life).toBe(maxLife(w));
  });
});

// 4 s is 240 steps; Town's regeneration runs alongside, so each Life
// Potion's share is measured against a Hero who didn't drink.
describe("a Life Potion", () => {
  /** Two Heroes in Town at 20 Life, the first having drunk `potions`. */
  function drinkerAndNot(potions: number): [World, World] {
    const drinker = inTown();
    const other = inTown();
    drinker.hero.life = 20;
    other.hero.life = 20;
    step(
      drinker,
      Array.from({ length: potions }, (_, column) => drink(column)),
    );
    step(other, []);
    return [drinker, other];
  }

  it("gives back 30 Life gradually over 4 s", () => {
    const [drinker, other] = drinkerAndNot(1);

    wait(drinker, 119);
    wait(other, 119);
    expect(drinker.hero.life - other.hero.life).toBeCloseTo(15);

    wait(drinker, 120);
    wait(other, 120);
    expect(drinker.hero.life - other.hero.life).toBeCloseTo(30);

    wait(drinker, 120);
    wait(other, 120);
    expect(drinker.hero.life - other.hero.life).toBeCloseTo(30);
  });

  it("stops at maximum Life", () => {
    const w = inTown();
    w.hero.life = maxLife(w) - 10;

    step(w, [drink(0)]);
    wait(w, 4 * 60);

    expect(w.hero.life).toBe(maxLife(w));
  });

  it("drunk back to back with another, each gives its full amount", () => {
    const [drinker, other] = drinkerAndNot(2);

    wait(drinker, 239);
    wait(other, 239);

    expect(drinker.hero.life - other.hero.life).toBeCloseTo(60);
  });

  it("shows as running until it has given all its Life back", () => {
    const w = inTown();
    w.hero.life = 20;

    step(w, [drink(0)]);
    expect(potionEffectsOf(w)).toEqual([
      { resource: "life", left: expect.closeTo(30 - 30 / 240) },
    ]);

    wait(w, 239);
    expect(potionEffectsOf(w)).toEqual([]);
  });

  it("isn't interrupted by taking damage", () => {
    const drinker = inCave(1);
    const other = inCave(1);
    stepUntil(drinker, "HeroHit");
    stepUntil(other, "HeroHit");
    stepUntil(drinker, "HeroHit");
    stepUntil(other, "HeroHit");
    // Low enough that the Potion's 30 Life can't reach the cap.
    drinker.hero.life = 40;
    other.hero.life = 40;

    step(drinker, [drink(0)]);
    step(other, []);
    let hits = 0;
    for (let i = 0; i < 239; i++) {
      hits += step(drinker, []).filter((e) => e.type === "HeroHit").length;
      step(other, []);
    }

    expect(hits).toBeGreaterThan(0);
    expect(other.hero.life).toBeGreaterThan(0);
    expect(drinker.hero.life - other.hero.life).toBeCloseTo(30);
  });
});

// Mana regenerates everywhere, so each Mana Potion's share is measured
// against a Hero who didn't drink.
describe("a Mana Potion", () => {
  /** Two Heroes in Town at no Mana, the first having drunk `potions`. */
  function drinkerAndNot(potions: number): [World, World] {
    const belt = [[MANA], [MANA], [MANA], [MANA]];
    const drinker = withBelt(belt);
    const other = withBelt(belt);
    drinker.hero.mana = 0;
    other.hero.mana = 0;
    step(
      drinker,
      Array.from({ length: potions }, (_, column) => drink(column)),
    );
    step(other, []);
    return [drinker, other];
  }

  it("gives back 20 Mana gradually over 4 s", () => {
    const [drinker, other] = drinkerAndNot(1);

    wait(drinker, 119);
    wait(other, 119);
    expect(drinker.hero.mana - other.hero.mana).toBeCloseTo(10);

    wait(drinker, 120);
    wait(other, 120);
    expect(drinker.hero.mana - other.hero.mana).toBeCloseTo(20);

    wait(drinker, 120);
    wait(other, 120);
    expect(drinker.hero.mana - other.hero.mana).toBeCloseTo(20);
  });

  it("leaves Life alone", () => {
    const [drinker, other] = drinkerAndNot(1);
    drinker.hero.life = 20;
    other.hero.life = 20;

    wait(drinker, 239);
    wait(other, 239);

    expect(drinker.hero.life).toBeCloseTo(other.hero.life);
  });

  it("stops at maximum Mana", () => {
    const w = withBelt([[MANA], [], [], []]);
    w.hero.mana = maxMana(w) - 5;

    step(w, [drink(0)]);
    wait(w, 4 * 60);

    expect(w.hero.mana).toBe(maxMana(w));
  });

  // Halfway through, as two Potions' full 40 would reach maximum Mana.
  it("drunk back to back with another, both give back at once", () => {
    const [drinker, other] = drinkerAndNot(2);

    wait(drinker, 119);
    wait(other, 119);

    expect(drinker.hero.mana - other.hero.mana).toBeCloseTo(20);
    expect(potionEffectsOf(drinker)).toEqual([
      { resource: "mana", left: expect.closeTo(10) },
      { resource: "mana", left: expect.closeTo(10) },
    ]);
  });

  it("runs alongside a Life Potion", () => {
    const w = withBelt([[MANA], [LIFE], [], []]);
    w.hero.life = 20;
    w.hero.mana = 0;

    step(w, [drink(0), drink(1)]);

    expect(potionEffectsOf(w)).toEqual([
      { resource: "mana", left: expect.closeTo(20 - 20 / 240) },
      { resource: "life", left: expect.closeTo(30 - 30 / 240) },
    ]);
  });
});

describe("a Rejuvenation Potion", () => {
  it("at once gives back 35% of maximum Life and of maximum Mana", () => {
    const w = withBelt([[REJUVENATION], [], [], []]);
    const other = withBelt([[REJUVENATION], [], [], []]);
    for (const hero of [w.hero, other.hero]) {
      hero.life = 1;
      hero.mana = 0;
    }

    const events = step(w, [drink(0)]);
    step(other, []);

    expect(events.map((event) => event.type)).toEqual([
      "PotionDrunk",
      "BeltChanged",
    ]);
    expect(w.hero.life - other.hero.life).toBeCloseTo(0.35 * maxLife(w));
    expect(w.hero.mana - other.hero.mana).toBeCloseTo(0.35 * maxMana(w));
    expect(potionEffectsOf(w)).toEqual([]);
  });

  it("stops at maximum Life and maximum Mana", () => {
    const w = withBelt([[REJUVENATION], [], [], []]);
    w.hero.life = maxLife(w) - 1;
    w.hero.mana = maxMana(w) - 1;

    step(w, [drink(0)]);

    expect(w.hero.life).toBe(maxLife(w));
    expect(w.hero.mana).toBe(maxMana(w));
  });
});

describe("Death and Potions", () => {
  it("ends every running Potion's effect", () => {
    const w = inCave(7);
    stepUntil(w, "HeroHit");

    step(w, [drink(0)]);
    expect(potionEffectsOf(w)).toHaveLength(1);
    stepUntil(w, "HeroDied");

    expect(potionEffectsOf(w)).toEqual([]);
    expect(w.hero.life).toBe(0);
  });

  it("refuses drinking", () => {
    const w = inCave(7);
    stepUntil(w, "HeroDied");

    expect(step(w, [drink(0)])).toEqual([]);
    wait(w, 60);
    expect(beltTypes(w)).toEqual([[LIFE], [LIFE], [LIFE], [LIFE]]);
    expect(w.hero.life).toBe(0);
  });
});
