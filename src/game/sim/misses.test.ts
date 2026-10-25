import { describe, expect, it } from "vitest";
import { itemOf } from "../tuning/items";
import { monsterTuning } from "../tuning/monsters";
import {
  attackRating,
  chanceToHit,
  createWorld,
  type Gear,
  heroChanceToHit,
  heroDefense,
  isInCombat,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area of open floor drawn row by row: `.` floor, `H` the
 * Hero's `start` and `S` one Skeleton, both in the middle of their tile.
 * `objects` adds more, such as Entries and Exits.
 */
function map(rows: string[], objects: object[] = []) {
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

function world(rows: string[], seed = 1): World {
  return createWorld({ areas: { town: map(rows) }, seed });
}

/** Steps the World `times` times with no orders, returning every event. */
function stepTimes(world: World, times: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < times; i++) events.push(...step(world, []));
  return events;
}

/** Attacks the Skeleton next to the Hero once, returning the whole swing's events. */
function swingOnce(w: World): SimEvent[] {
  const events = step(w, [{ type: "Attack", monster: w.monsters[0].id }]);
  return [...events, ...stepTimes(w, 8)];
}

/** The first seed at least `from` whose first swing at a Skeleton misses or hits. */
function seedWhere(missed: boolean, from = 1): number {
  for (let seed = from; seed < from + 100; seed++) {
    const events = swingOnce(world(["HS"], seed));
    if (events.some((event) => event.type === "Missed") === missed) return seed;
  }
  throw new Error(
    `No seed from ${from} where the first swing ${missed ? "misses" : "hits"}`,
  );
}

describe("chance to hit", () => {
  it("is about 85% for a fresh Hero against a Skeleton", () => {
    const w = world(["H.S"]);

    expect(attackRating(w)).toBe(100);
    expect(heroChanceToHit(w, "skeleton")).toBeCloseTo(0.85, 2);
  });

  it("follows 2 × AR / (AR + Defense)", () => {
    expect(chanceToHit(100, 300)).toBe(0.5);
    expect(chanceToHit(300, 500)).toBe(0.75);
  });

  it("is kept between 5% and 95%", () => {
    expect(chanceToHit(1, 1000)).toBe(0.05);
    expect(chanceToHit(1000, 1)).toBe(0.95);
    expect(chanceToHit(100, 0)).toBe(0.95);
  });
});

describe("swings", () => {
  it("Miss a Skeleton about 15% of the time, replaying from a seed", () => {
    let missed = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const events = swingOnce(world(["HS"], seed));
      expect(swingOnce(world(["HS"], seed))).toEqual(events);
      if (events.some((event) => event.type === "Missed")) missed += 1;
    }

    expect(missed).toBeGreaterThan(40);
    expect(missed).toBeLessThan(80);
  });

  it("report a Miss in place of the hit, with no damage", () => {
    const w = world(["HS"], seedWhere(true));
    const [skeleton] = w.monsters;

    expect(swingOnce(w)).toEqual([{ type: "Missed", target: skeleton.id }]);
    expect(skeleton.life).toBe(60);
  });
});

// A swing lands on its 8th step, and a hit's hitstop holds it for 4 more.
describe("a Miss", () => {
  it("causes no hitstop and no flinch", () => {
    for (let from = 1, checked = 0; checked < 10; checked++) {
      const seed = seedWhere(true, from);
      from = seed + 1;
      const w = world(["HS"], seed);
      const [skeleton] = w.monsters;
      swingOnce(w);
      expect(skeleton.flinch).toBe(0);

      // The rest of the 21-step swing, with no hitstop holding it.
      stepTimes(w, 12);
      expect(w.hero.swing).not.toBeNull();
      step(w, []);
      expect(w.hero.swing).toBeNull();
      expect(skeleton.flinch).toBe(0);
    }
  });

  // Town's Exit leads to an empty cave, where no Monster chases the Hero:
  // only damage dealt can keep them In Combat there.
  function swingThenLeave(seed: number) {
    const town = map(
      [
        "....", //
        ".H..",
        ".S..",
      ],
      [exit(3, 1, "cave", "from-town")],
    );
    const cave = map(["H..."], [entry("from-town", 1, 0)]);
    const w = createWorld({ areas: { town, cave }, seed });
    const events = swingOnce(w);
    step(w, [{ type: "MoveTo", target: { x: 3.5, y: 1.5 } }]);
    while (w.areaName === "town" || w.areaChange) events.push(...step(w, []));
    expect(events.filter((event) => event.type === "HeroHit")).toEqual([]);
    return { w, events };
  }

  it("doesn't keep the Hero In Combat by itself, as a hit does", () => {
    const missed = swingThenLeave(seedWhere(true));
    expect(missed.events).toContainEqual({ type: "Missed", target: 1 });
    expect(isInCombat(missed.w)).toBe(false);

    const hit = swingThenLeave(seedWhere(false));
    expect(hit.events).toContainEqual(
      expect.objectContaining({ type: "HitLanded", target: 1 }),
    );
    expect(isInCombat(hit.w)).toBe(true);
  });
});

/** The events up to and including the first Monster attack on the Hero. */
function untilAttacked(w: World): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < 60 * 10; i++) {
    const stepped = step(w, []);
    events.push(...stepped);
    if (stepped.some(isMonsterAttack)) return events;
  }
  throw new Error("No Monster attacked the Hero");
}

function isMonsterAttack(event: SimEvent): boolean {
  return (
    event.type === "HeroHit" ||
    (event.type === "Missed" && event.target === "hero")
  );
}

/** A Hero next to a Skeleton, wearing `equipment`. */
function wearing(equipment: Gear["equipment"], seed: number): World {
  return createWorld({
    areas: { town: map(["HS"]) },
    seed,
    gear: { inventory: [], equipment },
  });
}

/** The first seed at least `from` whose first Skeleton attack on Leather Armour Misses. */
function seedWhereMonsterMisses(from = 1): number {
  for (let seed = from; seed < from + 200; seed++) {
    const events = untilAttacked(wearing({ armour: "leatherArmour" }, seed));
    if (events.some((event) => event.type === "Missed")) return seed;
  }
  throw new Error(`No seed from ${from} where the Skeleton Misses`);
}

describe("Monsters", () => {
  it("have an Attack Rating that gives Leather Armour about 15% Misses", () => {
    expect(
      chanceToHit(
        monsterTuning.skeleton.attackRating,
        itemOf("leatherArmour").defense ?? 0,
      ),
    ).toBeCloseTo(0.85, 2);
  });

  it("Miss a Hero in Leather Armour about 15% of the time, replaying from a seed", () => {
    let missed = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const events = untilAttacked(wearing({ armour: "leatherArmour" }, seed));
      expect(untilAttacked(wearing({ armour: "leatherArmour" }, seed))).toEqual(
        events,
      );
      if (events.some((event) => event.type === "Missed")) missed += 1;
    }

    expect(missed).toBeGreaterThan(40);
    expect(missed).toBeLessThan(80);
  });

  it("Miss more often against Chain Mail", () => {
    const misses = (armour: "leatherArmour" | "chainMail") => {
      let missed = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const events = untilAttacked(wearing({ armour }, seed));
        if (events.some((event) => event.type === "Missed")) missed += 1;
      }
      return missed;
    };
    expect(misses("chainMail")).toBeGreaterThan(misses("leatherArmour"));
  });

  it("never Miss a Hero with 0 Defense", () => {
    const w = world(["HS"]);
    expect(heroDefense(w)).toBe(0);
    let attacks = 0;
    for (let i = 0; i < 60 * 60 && !w.death; i++) {
      const events = step(w, []);
      attacks += events.filter((event) => event.type === "HeroHit").length;
      expect(events.filter((event) => event.type === "Missed")).toEqual([]);
    }
    expect(attacks).toBeGreaterThan(10);
  });
});

describe("a Monster Miss", () => {
  it("reports a Miss on the Hero in place of the hit", () => {
    const w = wearing({ armour: "leatherArmour" }, seedWhereMonsterMisses());

    expect(untilAttacked(w).filter(isMonsterAttack)).toEqual([
      { type: "Missed", target: "hero" },
    ]);
  });

  it("deals no damage and causes no flinch", () => {
    for (let from = 1, checked = 0; checked < 10; checked++) {
      const seed = seedWhereMonsterMisses(from);
      from = seed + 1;
      const w = wearing({ armour: "leatherArmour" }, seed);
      const life = w.hero.life;
      untilAttacked(w);

      expect(w.hero.life).toBe(life);
      expect(w.hero.flinch).toBe(0);
    }
  });

  // As for the Hero's Misses: in the empty cave only damage taken can keep
  // the Hero In Combat.
  function attackedThenLeave(seed: number) {
    const town = map(
      [
        "....", //
        ".H..",
        ".S..",
      ],
      [exit(3, 1, "cave", "from-town")],
    );
    const cave = map(["H..."], [entry("from-town", 1, 0)]);
    const w = createWorld({
      areas: { town, cave },
      seed,
      gear: { inventory: [], equipment: { armour: "leatherArmour" } },
    });
    const events = untilAttacked(w);
    step(w, [{ type: "MoveTo", target: { x: 3.5, y: 1.5 } }]);
    while (w.areaName === "town" || w.areaChange) events.push(...step(w, []));
    return { w, attacks: events.filter(isMonsterAttack) };
  }

  it("doesn't keep the Hero In Combat, as a hit does", () => {
    const missed = attackedThenLeave(seedWhereMonsterMisses());
    expect(missed.attacks).toEqual([{ type: "Missed", target: "hero" }]);
    expect(isInCombat(missed.w)).toBe(false);

    const hit = attackedThenLeave(1);
    expect(hit.attacks).toEqual([expect.objectContaining({ type: "HeroHit" })]);
    expect(isInCombat(hit.w)).toBe(true);
  });
});
