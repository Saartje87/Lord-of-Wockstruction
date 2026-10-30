import { afterEach, describe, expect, it } from "vitest";
import { boneAltarTuning } from "../tuning/boneAltars";
import { heroTuning } from "../tuning/hero";
import { monsterTuning } from "../tuning/monsters";
import { isWalkable } from "./area";
import { newMinion } from "./minions";
import { combatArea } from "./testAreas";
import { distance } from "./vec";
import {
  createWorld,
  FRESH_PROGRESS,
  type Order,
  type Progress,
  questOf,
  type SimEvent,
  step,
  type World,
} from "./world";

/** A point object in the middle of tile (x, y). */
function point(type: string, name: string, x: number, y: number) {
  return { name, type, point: true, x: (x + 0.5) * 32, y: (y + 0.5) * 32 };
}

function strip(width: number, height: number, objects: object[]) {
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

function exit(to: string, entry: string, x: number) {
  return {
    name: "",
    type: "exit",
    x: x * 32,
    y: 0,
    width: 32,
    height: 5 * 32,
    properties: [
      { name: "area", type: "string", value: to },
      { name: "entry", type: "string", value: entry },
    ],
  };
}

// Town: the Trader at tile 3 and an Exit to the bog at the east end. The
// bog (named as the Quest names it): Level 3, with Bone Altars at tiles 5,
// 8 and 11 along its middle row, and an Exit back at the west end.
const town = strip(10, 5, [
  point("entry", "start", 1, 2),
  point("entry", "from-bog", 8, 2),
  point("npc", "Trader", 3, 2),
  exit("soggy-bog", "from-town", 9),
]);
const bog = combatArea(
  strip(14, 5, [
    point("entry", "start", 2, 2),
    point("entry", "from-town", 2, 2),
    point("boneAltar", "", 5, 2),
    point("boneAltar", "", 8, 2),
    point("boneAltar", "", 11, 2),
    exit("town", "from-bog", 0),
  ]),
  3,
);

/** Puts the Hero at (x, y), as if they had always stood there. */
function placeHero(world: World, x: number, y: number) {
  world.hero.pos = { x, y };
  world.hero.prevPos = { x, y };
}

/** Whether the Hero could stand at `at` in the active Area. */
function isWalkableForHero(world: World, at: { x: number; y: number }) {
  return isWalkable(world.areas[world.areaName], at);
}

const tuned = { ...boneAltarTuning };

afterEach(() => {
  Object.assign(boneAltarTuning, tuned);
});

function inBog(progress: Progress = FRESH_PROGRESS): World {
  return createWorld({
    areas: { town, "soggy-bog": bog },
    seed: 1,
    progress,
    start: { area: "soggy-bog", entry: "start" },
  });
}

function run(world: World, orders: Order[], steps: number): SimEvent[] {
  const events = step(world, orders);
  for (let i = 1; i < steps; i += 1) events.push(...step(world, []));
  return events;
}

/** The Hero never dies, flinches or is in the way of a quick test. */
function tough(world: World) {
  heroTuning.flinchChance = 0;
  world.hero.life = 1_000_000;
}

const flinch = heroTuning.flinchChance;
afterEach(() => {
  heroTuning.flinchChance = flinch;
});

/** Walks the Hero beside altar `index` and has them attack it until it falls. */
function destroy(world: World, index: number): SimEvent[] {
  const altar = world.boneAltars[index];
  return run(world, [{ type: "Attack", monster: altar.id }], 600);
}

describe("Bone Altars", () => {
  it("stand where the map puts them", () => {
    const world = inBog();

    expect(world.boneAltars.map(({ pos }) => pos)).toEqual([
      { x: 5.5, y: 2.5 },
      { x: 8.5, y: 2.5 },
      { x: 11.5, y: 2.5 },
    ]);
  });

  it("raise a Monster beside themselves at the Area Level, on a timer", () => {
    const world = inBog();
    tough(world);

    const events = run(world, [], 30 * 60);
    const raised = events.filter((e) => e.type === "BoneAltarRaised");

    expect(raised.length).toBeGreaterThan(0);
    for (const event of raised) {
      if (event.type !== "BoneAltarRaised") continue;
      const altar = world.boneAltars.find((a) => a.id === event.altar);
      const monster = world.monsters.find((m) => m.id === event.monster);
      if (!altar || !monster) throw new Error("raised from nothing");
      expect(["zombie", "skeleton"]).toContain(monster.type);
      expect(monster.monsterLevel).toBe(3);
      expect(distance(event.pos, altar.pos)).toBeCloseTo(
        boneAltarTuning.raiseDistance,
      );
    }
  });

  it("do not raise before the timer is up", () => {
    const world = inBog();
    tough(world);

    const events = run(world, [], 60);

    expect(events.some((e) => e.type === "BoneAltarRaised")).toBe(false);
  });

  it("raise no more than their limit of living Monsters each", () => {
    boneAltarTuning.raiseEveryMs = 500;
    boneAltarTuning.raisedLimit = 1;
    const world = inBog();
    tough(world);
    // The Hero keeps clear of everything, in the west.
    placeHero(world, 1.5, 0.5);

    run(world, [], 60 * 20);

    expect(world.monsters.length).toBe(3);
  });

  it("raise another once a Monster they raised is dead", () => {
    boneAltarTuning.raiseEveryMs = 500;
    boneAltarTuning.raisedLimit = 1;
    const world = inBog();
    tough(world);
    placeHero(world, 1.5, 0.5);
    run(world, [], 60 * 3);
    const first = world.monsters[0];

    world.monsters = world.monsters.filter((m) => m !== first);
    const events = run(world, [], 60 * 3);

    expect(events.some((e) => e.type === "BoneAltarRaised")).toBe(true);
    expect(world.monsters.length).toBe(3);
  });

  it("block the way", () => {
    const world = inBog();
    tough(world);
    placeHero(world, 7.5, 2.5);

    // Straight west along the row of the first altar.
    for (let i = 0; i < 120; i += 1) {
      step(world, [{ type: "Walk", direction: { x: -1, y: 0 } }]);
    }

    expect(world.hero.pos.x).toBeGreaterThan(6);
    expect(isWalkableForHero(world, { x: 5.5, y: 2.5 })).toBe(false);
  });

  it("are destroyed by the Hero's attacks, freeing their tile", () => {
    boneAltarTuning.life = 5;
    const world = inBog();
    tough(world);
    const altar = world.boneAltars[0];

    const events = destroy(world, 0);

    expect(events).toContainEqual({
      type: "BoneAltarDestroyed",
      altar: altar.id,
      area: "soggy-bog",
      pos: { x: 5.5, y: 2.5 },
    });
    expect(world.boneAltars).toHaveLength(2);
    expect(isWalkableForHero(world, { x: 5.5, y: 2.5 })).toBe(true);
  });

  it("are hit by an attack swung in place, in its arc", () => {
    boneAltarTuning.life = 1000;
    const world = inBog();
    tough(world);
    world.hero.pos = { x: 4.4, y: 2.5 };
    world.hero.prevPos = { ...world.hero.pos };

    const events = run(
      world,
      [{ type: "SwingAt", target: { x: 5.5, y: 2.5 } }],
      60,
    );

    expect(events.some((e) => e.type === "BoneAltarHit")).toBe(true);
  });

  it("are hit by the Hero's Projectiles", () => {
    boneAltarTuning.life = 1000;
    const world = inBog();
    tough(world);
    world.projectiles.push({
      kind: "boneSpear",
      pos: { x: 2.5, y: 2.5 },
      prevPos: { x: 2.5, y: 2.5 },
      direction: { x: 1, y: 0 },
      speed: 0.3,
      rangeLeft: 20,
      from: "hero",
      damage: [7, 7],
      hit: [],
    });

    const events = run(world, [], 30);

    expect(events).toContainEqual({
      type: "BoneAltarHit",
      altar: world.boneAltars[0].id,
      damage: 7,
    });
    // It stops at the altar, which blocks like a Prop.
    expect(world.projectiles).toHaveLength(0);
    expect(world.boneAltars[1].life).toBe(boneAltarTuning.life);
  });

  it("are hit by the Hero's Minions", () => {
    boneAltarTuning.life = 1000;
    const world = inBog();
    tough(world);
    world.minions.push(
      newMinion(
        world.nextMinionId++,
        "golem",
        "golem",
        1,
        { x: 4.2, y: 2.5 },
        0,
      ),
    );
    world.hero.pos = { x: 3.5, y: 2.5 };
    world.hero.prevPos = { ...world.hero.pos };

    run(world, [], 240);

    expect(world.boneAltars[0].life).toBeLessThan(1000);
  });

  it("are left alone by Monsters", () => {
    boneAltarTuning.life = 1000;
    boneAltarTuning.raiseEveryMs = 500;
    const world = inBog();
    tough(world);

    run(world, [], 60 * 30);

    expect(world.monsters.length).toBeGreaterThan(0);
    for (const altar of world.boneAltars) {
      expect(altar.life).toBe(1000);
    }
  });

  it("raise Monsters of the types they are tuned to", () => {
    boneAltarTuning.raiseEveryMs = 500;
    boneAltarTuning.raises = ["zombie"];
    const world = inBog();
    tough(world);
    placeHero(world, 1.5, 0.5);

    run(world, [], 60 * 10);

    expect(world.monsters.length).toBeGreaterThan(0);
    expect(world.monsters.every((m) => m.type === "zombie")).toBe(true);
    expect(monsterTuning.zombie).toBeDefined();
  });
});

describe("a Bone Altar placed out of reach", () => {
  it("fails the Area's validation, naming the Area", () => {
    const hole = strip(14, 5, [
      point("entry", "start", 2, 2),
      point("entry", "from-town", 2, 2),
      point("boneAltar", "", 5, 2),
    ]);
    hole.layers[0] = {
      type: "tilelayer",
      name: "floor",
      width: 14,
      height: 5,
      data: Array.from({ length: 70 }, (_, i) => (i === 2 * 14 + 5 ? 0 : 1)),
    } as (typeof hole.layers)[0];

    expect(() =>
      createWorld({
        areas: { town, "soggy-bog": combatArea(hole, 3) },
        seed: 1,
      }),
    ).toThrow(/soggy-bog.*Bone Altar/);
  });
});

describe("Bone Altars and the Session", () => {
  it("stay as they were when the Hero returns, wounded or destroyed", () => {
    boneAltarTuning.life = 5;
    const world = inBog();
    tough(world);
    destroy(world, 0);
    const wounded = world.boneAltars[0];
    wounded.life = 3;

    // Out through the west Exit and back in from Town.
    run(world, [{ type: "MoveTo", target: { x: 0.5, y: 2.5 } }], 600);
    expect(world.areaName).toBe("town");
    run(world, [{ type: "MoveTo", target: { x: 9.5, y: 2.5 } }], 900);
    expect(world.areaName).toBe("soggy-bog");

    expect(world.boneAltars).toHaveLength(2);
    expect(world.boneAltars[0].life).toBe(3);
    expect(isWalkableForHero(world, { x: 5.5, y: 2.5 })).toBe(true);
  });

  it("are all placed again in a new Session before the Quest is Done", () => {
    const readyQuest: Progress = {
      ...FRESH_PROGRESS,
      quests: {
        ...FRESH_PROGRESS.quests,
        "bog-off": { state: "ready", count: 3 },
      },
    };

    expect(inBog(readyQuest).boneAltars).toHaveLength(3);
  });

  it("are not placed in a new Session once the Quest is Done", () => {
    const doneQuest: Progress = {
      ...FRESH_PROGRESS,
      quests: {
        ...FRESH_PROGRESS.quests,
        "bog-off": { state: "done", count: 3 },
      },
    };
    const world = inBog(doneQuest);

    expect(world.boneAltars).toHaveLength(0);
    expect(isWalkableForHero(world, { x: 5.5, y: 2.5 })).toBe(true);
  });
});

describe('"Bog Off"', () => {
  it("counts each altar destroyed, even before it is Given", () => {
    boneAltarTuning.life = 3;
    const world = inBog();
    tough(world);

    const events = destroy(world, 0);

    expect(events).toContainEqual({
      type: "QuestCounted",
      quest: "bog-off",
      count: 1,
    });
    expect(questOf(world, "bog-off")).toEqual({ state: "notGiven", count: 1 });
  });

  it("is Ready once all 3 are destroyed, Given or not", () => {
    boneAltarTuning.life = 3;
    const world = inBog();
    tough(world);

    destroy(world, 0);
    destroy(world, 0);
    const events = destroy(world, 0);

    expect(events).toContainEqual({ type: "QuestReady", quest: "bog-off" });
    expect(questOf(world, "bog-off").state).toBe("ready");
  });

  it("gives 1 Skill Point when handed in to the Trader, once", () => {
    const world = createWorld({
      areas: { town, "soggy-bog": bog },
      seed: 1,
      progress: {
        ...FRESH_PROGRESS,
        quests: {
          ...FRESH_PROGRESS.quests,
          "bog-off": { state: "ready", count: 3 },
        },
      },
    });
    world.hero.pos = { x: 2.5, y: 2.5 };
    const before = world.hero.progress.skillPoints;

    step(world, [{ type: "HandInQuest", quest: "bog-off" }]);
    step(world, [{ type: "HandInQuest", quest: "bog-off" }]);

    expect(questOf(world, "bog-off").state).toBe("done");
    expect(world.hero.progress.skillPoints).toBe(before + 1);
  });
});
