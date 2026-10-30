import { afterEach, describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { uniqueTuning } from "../tuning/uniqueMonsters";
import { loadArea } from "./area";
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

const flinch = heroTuning.flinchChance;
afterEach(() => {
  heroTuning.flinchChance = flinch;
});

/** Has the Hero attack the Unique Monster until it dies; the events. */
function kill(world: World): SimEvent[] {
  heroTuning.flinchChance = 0;
  const [monster] = world.monsters;
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

  it("have more Life, damage, Attack Rating and Experience than their type", () => {
    const ordinary = { type: "zombie", monsterLevel: 3 } as const;
    const special = { ...ordinary, unique: "Sir Soaks-a-Lot" };

    expect(monsterMaxLife(special)).toBe(
      Math.round(monsterMaxLife(ordinary) * uniqueTuning.life),
    );
    expect(monsterDamageRange(special)[1]).toBeGreaterThan(
      monsterDamageRange(ordinary)[1],
    );
    expect(monsterAttackRating(special)).toBeGreaterThan(
      monsterAttackRating(ordinary),
    );
    expect(monsterExperience(special)).toBeGreaterThan(
      monsterExperience(ordinary),
    );
    expect(killExperience(special, 3)).toBeGreaterThan(
      killExperience(ordinary, 3),
    );
  });

  it("start at their full, greater Life", () => {
    const [monster] = inSpa().monsters;

    expect(monster.life).toBe(monsterMaxLife(monster));
  });

  it("drop better Items: at least one Item every time", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const events = kill(inSpa(FRESH_PROGRESS, seed));

      expect(
        events.filter((event) => event.type === "ItemDropped").length,
      ).toBeGreaterThanOrEqual(1);
    }
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
