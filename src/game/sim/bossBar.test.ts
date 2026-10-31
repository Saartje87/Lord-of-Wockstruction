import { describe, expect, it } from "vitest";
import { monsterMaxLife } from "./monsters";
import { combatArea } from "./testAreas";
import {
  bossBarOf,
  createWorld,
  FRESH_PROGRESS,
  step,
  type World,
} from "./world";

/** A point object in the middle of tile (x, 1). */
function point(type: string, name: string, x: number, properties?: object[]) {
  return {
    name,
    type,
    point: true,
    x: (x + 0.5) * 32,
    y: 1.5 * 32,
    ...(properties ? { properties } : {}),
  };
}

function map(objects: object[]) {
  return {
    orientation: "orthogonal",
    width: 40,
    height: 3,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 40,
        height: 3,
        data: new Array(120).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

const town = map([point("entry", "start", 1)]);

/**
 * The Ossuary with Grave Wockington `gap` tiles from the Hero, and a Unique
 * Monster that isn't the Act Boss and an ordinary Skeleton far off.
 */
function ossuary(gap: number): World {
  const area = combatArea(
    map([
      point("entry", "start", 1),
      point("actBoss", "Grave Wockington", 1 + gap, [
        { name: "monster", type: "string", value: "grave_wockington" },
      ]),
      point("uniqueMonster", "Sir Soaks-a-Lot", 38, [
        { name: "monster", type: "string", value: "zombie" },
      ]),
      point("monsterSpawn", "", 37, [
        { name: "monster", type: "string", value: "skeleton" },
      ]),
    ]),
    11,
  );
  return createWorld({
    areas: { town, ossuary: area },
    seed: 1,
    progress: FRESH_PROGRESS,
    start: { area: "ossuary", entry: "start" },
  });
}

function bossOf(world: World) {
  const boss = world.monsters.find((m) => m.type === "grave_wockington");
  if (!boss) throw new Error("no Grave Wockington");
  return boss;
}

function wait(world: World, steps: number) {
  for (let i = 0; i < steps; i++) {
    step(world, []);
    world.hero.life = 1_000_000;
  }
}

describe("the Boss bar query", () => {
  it("is null while the Act Boss hasn't noticed the Hero", () => {
    const world = ossuary(30);

    wait(world, 30);

    expect(bossBarOf(world)).toBeNull();
  });

  it("gives the Act Boss's name and Life while he is In Combat", () => {
    const world = ossuary(6);
    wait(world, 30);
    const boss = bossOf(world);
    boss.life = monsterMaxLife(boss) / 2;

    expect(bossBarOf(world)).toEqual({
      name: "Grave Wockington",
      life: monsterMaxLife(boss) / 2,
      maxLife: monsterMaxLife(boss),
    });
  });

  it("goes when he starts Returning", () => {
    const world = ossuary(6);
    wait(world, 30);
    expect(bossBarOf(world)).not.toBeNull();

    bossOf(world).state = "return";

    expect(bossBarOf(world)).toBeNull();
  });

  it("goes when he dies", () => {
    const world = ossuary(6);
    wait(world, 30);

    world.monsters = world.monsters.filter(
      (m) => m.type !== "grave_wockington",
    );

    expect(bossBarOf(world)).toBeNull();
  });

  it("is never given for another Monster, Unique or not", () => {
    const world = ossuary(30);
    for (const monster of world.monsters) {
      if (monster.type !== "grave_wockington") monster.state = "chase";
    }

    expect(bossBarOf(world)).toBeNull();
  });
});
