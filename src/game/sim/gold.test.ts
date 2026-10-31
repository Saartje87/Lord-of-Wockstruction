import { describe, expect, it } from "vitest";
import { changesSave } from "../save";
import { goldTuning } from "../tuning/gold";
import { dropTuning, potionDropTuning } from "../tuning/items";
import { emptyBelt } from "./belt";
import type { Belongings } from "./inventory";
import { newMinion } from "./minions";
import { combatArea } from "./testAreas";
import {
  createWorld,
  FRESH_PROGRESS,
  type SimEvent,
  step,
  type World,
} from "./world";

/** A row of floor: `H` the Hero's `start`, `S` a Skeleton, `E` an Exit. */
function map(row: string, exitTo = "") {
  const objects: object[] = [];
  [...row].forEach((cell, column) => {
    const x = (column + 0.5) * 32;
    const y = 16;
    if (cell === "H") {
      objects.push({ name: "start", type: "entry", point: true, x, y });
    }
    if (cell === "E") {
      objects.push({
        name: "",
        type: "exit",
        x: column * 32,
        y: 0,
        width: 32,
        height: 32,
        properties: [
          { name: "area", type: "string", value: exitTo },
          { name: "entry", type: "string", value: "start" },
        ],
      });
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
    width: row.length,
    height: 1,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: row.length,
        height: 1,
        data: new Array(row.length).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

/** Every kill drops a Gold Pile and nothing else. */
function onlyGold() {
  goldTuning.chance = 1;
  dropTuning.chance = 0;
  potionDropTuning.chance = 0;
}

function town(
  row = "H.S..",
  { seed = 1, belongings }: { seed?: number; belongings?: Belongings } = {},
): World {
  return createWorld({
    areas: { town: map(row) },
    seed,
    belongings,
    progress: { ...FRESH_PROGRESS, vitality: 200 },
  });
}

/** Attacks the one Monster until it dies, returning the events. */
function killWithHero(world: World): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < 60 * 60; i++) {
    const [monster] = world.monsters;
    if (!monster) return all;
    const events = step(world, [{ type: "Attack", monster: monster.id }]);
    all.push(...events);
  }
  throw new Error("Never killed it");
}

const ofType = <T extends SimEvent["type"]>(events: SimEvent[], type: T) =>
  events.filter(
    (event): event is Extract<SimEvent, { type: T }> => event.type === type,
  );

describe("Gold Piles", () => {
  it("drop where a Monster killed by the Hero died, apart from Items and Potions", () => {
    onlyGold();
    const world = town();
    const [skeleton] = world.monsters;
    skeleton.monsterLevel = 1;

    const events = killWithHero(world);

    const [dropped] = ofType(events, "GoldDropped");
    expect(world.goldPiles).toHaveLength(1);
    expect(world.groundItems).toEqual([]);
    expect(world.goldPiles[0]).toEqual({
      id: dropped.pile,
      amount: dropped.amount,
      pos: dropped.pos,
    });
    expect(world.corpses[0].pos).toEqual(dropped.pos);
  });

  it("drop by their own chance", () => {
    goldTuning.chance = 0;
    dropTuning.chance = 1;
    expect(killWithHero(town()).some((e) => e.type === "GoldDropped")).toBe(
      false,
    );

    onlyGold();
    goldTuning.chance = 0.5;
    let piles = 0;
    const kills = 200;
    for (let seed = 1; seed <= kills; seed++) {
      piles += ofType(
        killWithHero(town("H.S..", { seed })),
        "GoldDropped",
      ).length;
    }
    expect(piles / kills).toBeGreaterThan(0.4);
    expect(piles / kills).toBeLessThan(0.6);
  });

  it("hold more the higher the Monster Level", () => {
    onlyGold();
    goldTuning.perMonsterLevel = [2, 5];
    const amountsAt = (monsterLevel: number) => {
      const amounts = new Set<number>();
      for (let seed = 1; seed <= 40; seed++) {
        const world = town("H.S..", { seed });
        world.monsters[0].monsterLevel = monsterLevel;
        for (const { amount } of ofType(killWithHero(world), "GoldDropped")) {
          amounts.add(amount);
        }
      }
      return [...amounts];
    };

    const low = amountsAt(1);
    const high = amountsAt(10);

    expect(Math.min(...low)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...low)).toBeLessThanOrEqual(5);
    expect(Math.min(...high)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...high)).toBeLessThanOrEqual(50);
    expect(Number.isInteger(Math.min(...high))).toBe(true);
    expect(high.length).toBeGreaterThan(5);
  });

  it("drop from a Monster killed by a Minion too", () => {
    onlyGold();
    const world = town("H.......S");
    const [skeleton] = world.monsters;
    skeleton.life = 1;
    world.minions.push(
      newMinion(world.nextMinionId++, "golem", "golem", 1, skeleton.pos, 0),
    );

    const events: SimEvent[] = [];
    for (let i = 0; i < 600 && world.goldPiles.length === 0; i++) {
      events.push(...step(world, []));
    }

    expect(events.some((e) => e.type === "MonsterDied")).toBe(true);
    expect(world.goldPiles).toHaveLength(1);
  });

  it("lie in their Area as the Hero left it, found again by any way back, for the Session", () => {
    const world = createWorld({
      areas: {
        town: map("H.E..", "field"),
        field: combatArea(map("HE", "town")),
      },
      seed: 1,
    });
    world.goldPiles.push({ id: 7, amount: 7, pos: { x: 4.5, y: 0.5 } });
    let before = world.areaName;
    const walkTo = (x: number) => {
      step(world, [{ type: "MoveTo", target: { x, y: 0.5 } }]);
      for (let i = 0; i < 300 && world.areaName === before; i++) {
        step(world, []);
      }
      while (world.areaChange) step(world, []);
    };

    walkTo(2.5);
    expect(world.areaName).toBe("field");
    expect(world.goldPiles).toEqual([]);

    before = world.areaName;
    walkTo(1.5);
    expect(world.areaName).toBe("town");
    expect(world.goldPiles).toEqual([
      { id: 7, amount: 7, pos: { x: 4.5, y: 0.5 } },
    ]);
  });
});

/** A Hero standing at `H` with a Gold Pile of `amount` at `tiles` east of them. */
function withPile(tiles: number, amount = 30, belongings?: Belongings) {
  const world = town("H....", { belongings });
  const { pos } = world.hero;
  world.goldPiles.push({
    id: 1,
    amount,
    pos: { x: pos.x + tiles, y: pos.y },
  });
  return world;
}

describe("Picking up Gold", () => {
  it("adds a pile's amount to Gold the moment the Hero is within the radius, no Order given", () => {
    const world = withPile(goldTuning.pickupReach - 0.1, 30);

    const events = step(world, []);

    expect(ofType(events, "GoldPickedUp")).toEqual([
      { type: "GoldPickedUp", amount: 30 },
    ]);
    expect(world.hero.progress.gold).toBe(30);
    expect(world.goldPiles).toEqual([]);
  });

  it("leaves a pile out of the radius lying until the Hero walks up to it", () => {
    const world = withPile(2.5, 12);

    expect(ofType(step(world, []), "GoldPickedUp")).toEqual([]);
    expect(world.hero.progress.gold).toBe(0);

    step(world, [{ type: "MoveTo", target: { x: 3.5, y: 0.5 } }]);
    for (let i = 0; i < 120; i++) step(world, []);

    expect(world.hero.progress.gold).toBe(12);
    expect(world.goldPiles).toEqual([]);
  });

  it("adds up pile after pile", () => {
    const world = withPile(0.2, 10);
    world.goldPiles.push({ id: 2, amount: 5, pos: { ...world.hero.pos } });

    step(world, []);

    expect(world.hero.progress.gold).toBe(15);
  });

  it("works with a full Inventory", () => {
    const full: Belongings = {
      inventory: [
        ...[0, 2, 4, 6, 8].map((column) => ({
          type: "axe" as const,
          cell: { column, row: 0 },
        })),
        ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((column) =>
          [3].map((row) => ({
            type: "ring" as const,
            cell: { column, row },
          })),
        ),
      ],
      equipment: {},
      belt: emptyBelt(),
    };
    const world = withPile(0.1, 9, full);

    step(world, []);

    expect(world.hero.progress.gold).toBe(9);
  });

  it("never happens during Death", () => {
    const world = withPile(0.1, 9);
    world.death = { elapsed: 0 };

    const events = step(world, []);

    expect(ofType(events, "GoldPickedUp")).toEqual([]);
    expect(world.hero.progress.gold).toBe(0);
    expect(world.goldPiles).toHaveLength(1);
  });

  it("is a change the Save keeps", () => {
    expect(changesSave([{ type: "GoldPickedUp", amount: 3 }])).toBe(true);
  });

  it("is kept through Death", () => {
    const world = town("H.S..");
    world.hero.progress.gold = 9;
    world.hero.life = 1;
    for (let i = 0; i < 600 && !world.death; i++) step(world, []);

    expect(world.death).not.toBeNull();
    expect(world.hero.progress.gold).toBe(9);
  });
});
