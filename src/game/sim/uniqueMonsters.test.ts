import { describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { isPotion } from "../tuning/items";
import { uniqueTuning } from "../tuning/uniqueMonsters";
import { loadArea } from "./area";
import { monsterResistances, resistancesOf } from "./damage";
import {
  killExperience,
  monsterAttackRating,
  monsterDamageRange,
  monsterExperience,
  monsterMaxLife,
} from "./monsters";
import { combatArea } from "./testAreas";
import {
  createWorld,
  FRESH_PROGRESS,
  type Order,
  questOf,
  type SimEvent,
  step,
  type World,
} from "./world";

/** A point object in the middle of tile (x, y). */
function point(type: string, name: string, x: number, y: number) {
  return { name, type, point: true, x: (x + 0.5) * 32, y: (y + 0.5) * 32 };
}

/** A `uniqueMonster` of `monster` type called `name` on tile (x, 1). */
function unique(name: string, monster: string, x: number) {
  return {
    ...point("uniqueMonster", name, x, 1),
    properties: [{ name: "monster", type: "string", value: monster }],
  };
}

function map(objects: object[]) {
  return {
    orientation: "orthogonal",
    width: 12,
    height: 3,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 12,
        height: 3,
        data: new Array(36).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

const town = map([point("entry", "start", 1, 1)]);

/** The Spa: one Unique Zombie, standing where the Hero can reach it. */
const spa = combatArea(
  map([point("entry", "start", 1, 1), unique("Sir Soaks-a-Lot", "zombie", 4)]),
  3,
);

function inSpa(progress = FRESH_PROGRESS, seed = 1): World {
  return createWorld({
    areas: { town, spa },
    seed,
    progress,
    start: { area: "spa", entry: "start" },
  });
}

/** Has the Hero attack the Unique Monster until it dies; the events. */
function kill(world: World): SimEvent[] {
  heroTuning.flinchChance = 0;
  const [monster] = world.monsters;
  monster.life = 1;
  const events: SimEvent[] = [];
  for (let i = 0; i < 6000 && world.monsters.includes(monster); i++) {
    const orders: Order[] =
      i % 120 === 0 ? [{ type: "Attack", monster: monster.id }] : [];
    events.push(...step(world, orders));
    world.hero.life = 1_000_000;
  }
  return events;
}

describe("Unique Monsters", () => {
  it("are placed by the map, named, of the type it gives", () => {
    const world = inSpa();
    const [monster] = world.monsters;

    expect(world.monsters).toHaveLength(1);
    expect(monster.type).toBe("zombie");
    expect(monster.unique).toBe("Sir Soaks-a-Lot");
    expect(monster.monsterLevel).toBe(3);
    expect(monster.pos).toEqual({ x: 4.5, y: 1.5 });
  });

  it("have the Unique Life multiplier, 1.5x the damage and 5x the Experience of their type at the same Monster Level", () => {
    const ordinary = { type: "zombie", monsterLevel: 3 } as const;
    const special = { ...ordinary, unique: "Sir Soaks-a-Lot" };

    expect(monsterMaxLife(special)).toBe(
      Math.round(monsterMaxLife(ordinary) * uniqueTuning.life),
    );
    const [low, high] = monsterDamageRange(ordinary);
    expect(monsterDamageRange(special)[0]).toBe(Math.round(low * 1.5));
    expect(monsterDamageRange(special)[1]).toBe(Math.round(high * 1.5));
    expect(monsterExperience(special)).toBe(monsterExperience(ordinary) * 5);
    expect(monsterAttackRating(special)).toBeGreaterThan(
      monsterAttackRating(ordinary),
    );
    expect(killExperience(special, 3)).toBeGreaterThan(
      killExperience(ordinary, 3),
    );
  });

  it("start at their full, greater Life", () => {
    const [monster] = inSpa().monsters;

    expect(monster.life).toBe(monsterMaxLife(monster));
  });

  it("always drop a Rare Item and a Magic or Rare one, with Affixes", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const items = kill(inSpa(FRESH_PROGRESS, seed))
        .filter((event) => event.type === "ItemDropped")
        .map((event) => event.item)
        .filter((item) => !isPotion(item.type));

      expect(items).toHaveLength(2);
      expect(items[0].rarity).toBe("rare");
      expect(["magic", "rare"]).toContain(items[1].rarity);
      for (const item of items) {
        expect(item.affixes.length).toBeGreaterThanOrEqual(
          item.rarity === "rare" ? 3 : 1,
        );
      }
    }
  });

  it("roll both Magic and Rare for the second Item across seeds", () => {
    const second = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const items = kill(inSpa(FRESH_PROGRESS, seed))
        .filter((event) => event.type === "ItemDropped")
        .map((event) => event.item)
        .filter((item) => !isPotion(item.type));
      second.add(items[1].rarity);
    }

    expect([...second].sort()).toEqual(["magic", "rare"]);
  });

  it("come back in every new Session, whatever the Quests", () => {
    const done = {
      ...FRESH_PROGRESS,
      quests: {
        ...FRESH_PROGRESS.quests,
        "spa-day": { state: "done" as const, count: 1 },
      },
    };

    expect(inSpa(done).monsters.map((m) => m.unique)).toEqual([
      "Sir Soaks-a-Lot",
    ]);
  });

  it("make the Quest that asks for their kill Ready", () => {
    const world = inSpa();
    const events = kill(world);

    expect(events).toContainEqual({ type: "QuestReady", quest: "spa-day" });
    expect(questOf(world, "spa-day").state).toBe("ready");
  });
});

describe("a Unique Monster object", () => {
  const load = (objects: object[]) =>
    loadArea(
      "spa",
      combatArea(map([point("entry", "start", 1, 1), ...objects])),
    );

  it("must name a Monster type that exists", () => {
    expect(() => load([unique("Bob", "dragon", 4)])).toThrow(/unknown type/);
  });

  it("must have a name", () => {
    expect(() => load([unique("", "zombie", 4)])).toThrow(/without a name/);
  });
});

describe("Unique Monster Resistances", () => {
  it("are its Monster type's unless its own tuning overrides them", () => {
    const zombie = { type: "zombie", unique: "Sir Soaks-a-Lot" } as const;
    expect(resistancesOf(zombie)).toEqual(monsterResistances("zombie"));

    uniqueTuning.resistances["Sir Soaks-a-Lot"] = { fire: 75 };
    expect(resistancesOf(zombie)).toEqual({ fire: 75 });
    expect(resistancesOf({ type: "zombie", unique: null })).toEqual(
      monsterResistances("zombie"),
    );
  });
});
