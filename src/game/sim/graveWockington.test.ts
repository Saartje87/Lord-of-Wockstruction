import { afterEach, describe, expect, it } from "vitest";
import { graveWockingtonTuning } from "../tuning/graveWockington";
import { heroTuning } from "../tuning/hero";
import { loadArea } from "./area";
import { monsterMaxLife } from "./monsters";
import { combatArea } from "./testAreas";
import { msToSteps } from "./units";
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

/** The Act Boss spawn: Grave Wockington on tile (x, 1). */
function actBoss(x: number) {
  return {
    ...point("actBoss", "Grave Wockington", x, 1),
    properties: [
      { name: "monster", type: "string", value: "grave_wockington" },
    ],
  };
}

function map(width: number, objects: object[]) {
  return {
    orientation: "orthogonal",
    width,
    height: 3,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width,
        height: 3,
        data: new Array(width * 3).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

const town = map(6, [point("entry", "start", 1, 1)]);

/** The Ossuary, with the Hero `gap` tiles from Grave Wockington. */
function ossuary(gap: number) {
  return combatArea(
    map(40, [point("entry", "start", 1, 1), actBoss(1 + gap)]),
    11,
  );
}

function inOssuary(gap: number, progress: Progress = FRESH_PROGRESS): World {
  return createWorld({
    areas: { town, ossuary: ossuary(gap) },
    seed: 1,
    progress,
    start: { area: "ossuary", entry: "start" },
  });
}

/** Progress with the Act Boss Quest in `state`. */
function actBossIs(state: "notGiven" | "given" | "ready" | "done"): Progress {
  return {
    ...FRESH_PROGRESS,
    quests: { ...FRESH_PROGRESS.quests, "act-boss": { state, count: 0 } },
  };
}

const flinch = heroTuning.flinchChance;
afterEach(() => {
  heroTuning.flinchChance = flinch;
});

/** Steps `world` `steps` times, with nobody hurting the Hero; the events. */
function wait(world: World, steps: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < steps; i++) {
    events.push(...step(world, []));
    world.hero.life = 1_000_000;
  }
  return events;
}

/** Has the Hero attack Grave Wockington until he dies; the events. */
function kill(world: World): SimEvent[] {
  heroTuning.flinchChance = 0;
  const boss = world.monsters.find((m) => m.type === "grave_wockington");
  if (!boss) throw new Error("no Grave Wockington");
  boss.life = 1;
  const events: SimEvent[] = [];
  for (let i = 0; i < 6000 && world.monsters.includes(boss); i++) {
    const orders: Order[] =
      i % 120 === 0 ? [{ type: "Attack", monster: boss.id }] : [];
    events.push(...step(world, orders));
    world.hero.life = 1_000_000;
  }
  return events;
}

describe("Grave Wockington", () => {
  it("waits where the map puts him, a Unique Monster of his own type", () => {
    const world = inOssuary(30);
    const [boss] = world.monsters;

    expect(world.monsters).toHaveLength(1);
    expect(boss.type).toBe("grave_wockington");
    expect(boss.unique).toBe("Grave Wockington");
    expect(boss.monsterLevel).toBe(11);
    expect(boss.life).toBe(monsterMaxLife(boss));
  });

  it("raises no Skeletons while he hasn't noticed the Hero", () => {
    const world = inOssuary(30);

    const events = wait(world, 60 * 30);

    expect(events.some((event) => event.type === "WaveRaised")).toBe(false);
    expect(world.monsters).toHaveLength(1);
  });

  it("raises a wave of Skeletons around himself once after the Hero", () => {
    const world = inOssuary(6);
    const [boss] = world.monsters;

    const events = wait(
      world,
      msToSteps(graveWockingtonTuning.firstWaveMs) + 5,
    );
    const wave = events.find((event) => event.type === "WaveRaised");

    expect(wave).toMatchObject({ type: "WaveRaised", boss: boss.id });
    const raised = world.monsters.filter((m) => m.id !== boss.id);
    expect(raised).toHaveLength(graveWockingtonTuning.waveSize);
    for (const skeleton of raised) {
      expect(skeleton.type).toBe("skeleton");
      expect(skeleton.monsterLevel).toBe(11);
      expect(skeleton.unique).toBeNull();
    }
  });

  it("raises more in later waves, never above his limit alive", () => {
    const world = inOssuary(6);
    const waveSteps = msToSteps(graveWockingtonTuning.waveEveryMs);

    const events = wait(world, 4 * waveSteps);

    const waves = events.filter((event) => event.type === "WaveRaised");
    expect(waves.length).toBeGreaterThanOrEqual(2);
    const alive = world.monsters.filter((m) => m.type === "skeleton");
    expect(alive.length).toBeLessThanOrEqual(graveWockingtonTuning.raisedLimit);
  });

  it("is back in every new Session", () => {
    const first = inOssuary(30, actBossIs("done"));
    const second = inOssuary(30, actBossIs("done"));

    for (const world of [first, second]) {
      expect(world.monsters.map((m) => m.unique)).toEqual(["Grave Wockington"]);
    }
  });
});

describe("killing Grave Wockington", () => {
  it.each([
    "notGiven",
    "given",
  ] as const)("completes the Act and makes the Quest Ready when it is %s", (state) => {
    const world = inOssuary(3, actBossIs(state));

    const events = kill(world);

    expect(events).toContainEqual({ type: "ActCompleted", act: 1 });
    expect(events).toContainEqual({ type: "QuestReady", quest: "act-boss" });
    expect(questOf(world, "act-boss").state).toBe("ready");
  });

  it("completes the Act again while the Quest is Ready but not handed in", () => {
    const events = kill(inOssuary(3, actBossIs("ready")));

    expect(events).toContainEqual({ type: "ActCompleted", act: 1 });
  });

  it("shows no Act Complete once the Quest is Done", () => {
    const world = inOssuary(3, actBossIs("done"));

    const events = kill(world);

    expect(events.some((event) => event.type === "MonsterDied")).toBe(true);
    expect(events.some((event) => event.type === "ActCompleted")).toBe(false);
    expect(questOf(world, "act-boss").state).toBe("done");
  });

  it("leaves play going on in the Area", () => {
    const world = inOssuary(3);

    kill(world);
    step(world, []);

    expect(world.areaName).toBe("ossuary");
    expect(world.death).toBeNull();
  });
});

describe("an Act Boss object", () => {
  it("must not appear twice in one Area", () => {
    expect(() =>
      loadArea(
        "ossuary",
        combatArea(
          map(10, [point("entry", "start", 1, 1), actBoss(4), actBoss(5)]),
        ),
      ),
    ).toThrow(/two Act Boss/);
  });
});
