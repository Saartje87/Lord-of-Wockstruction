import { describe, expect, it } from "vitest";
import { combatArea } from "./testAreas";
import {
  AREA_CHANGE_STEPS,
  createWorld,
  FRESH_PROGRESS,
  hasQuestToDeal,
  npcsIn,
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

/** An `npc` that stands only while "Lost Wanderer" is (not) Ready to hand in. */
function wanderer(x: number, ready: boolean) {
  return {
    ...point("npc", "Wanderer", x, 1),
    properties: [
      { name: "quest", type: "string", value: "lost-wanderer" },
      { name: "questReady", type: "bool", value: ready },
    ],
  };
}

function area(objects: object[]) {
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

/** Where an Exit to `to` stands: the right-hand end of the strip. */
function exit(to: string, entry: string) {
  return {
    name: "",
    type: "exit",
    x: 10 * 32,
    y: 0,
    width: 64,
    height: 96,
    properties: [
      { name: "area", type: "string", value: to },
      { name: "entry", type: "string", value: entry },
    ],
  };
}

// Town: the Elder at tile 5, the Wanderer back at tile 8 once rescued, and
// an Exit to the Mill. Mill: the Wanderer at tile 6 until rescued.
const town = area([
  point("entry", "start", 1, 1),
  point("entry", "from-mill", 9, 1),
  point("npc", "Elder", 5, 1),
  wanderer(8, true),
  exit("mill", "start"),
]);
const mill = combatArea(
  area([
    point("entry", "start", 1, 1),
    point("entry", "from-town", 1, 1),
    wanderer(6, false),
    exit("town", "from-mill"),
  ]),
);

const ELDER = 0;
const TOWN_WANDERER = 1;
const MILL_WANDERER = 0;

function newWorld(progress?: Progress, start?: "mill"): World {
  return createWorld({
    areas: { town, mill },
    seed: 1,
    progress,
    start: start ? { area: "mill", entry: "start" } : null,
  });
}

function run(world: World, orders: Order[], steps = 300): SimEvent[] {
  const events = step(world, orders);
  for (let i = 1; i < steps; i += 1) events.push(...step(world, []));
  return events;
}

/** Puts the Hero next to the NPC `name`, in reach to talk. */
function standBeside(world: World, npc: number) {
  const there = npcsIn(world).find(({ id }) => id === npc);
  if (!there) throw new Error("No such NPC");
  world.hero.pos = { x: there.pos.x - 1, y: there.pos.y };
  world.hero.prevPos = { ...world.hero.pos };
}

function withQuests(quests: Partial<Progress["quests"]>): Progress {
  return {
    ...FRESH_PROGRESS,
    quests: { ...FRESH_PROGRESS.quests, ...quests },
  };
}

describe("Quests", () => {
  it("start Not given", () => {
    const world = newWorld();

    expect(questOf(world, "lost-wanderer")).toEqual({
      state: "notGiven",
      count: 0,
    });
  });

  it("are Given by talking to the giver, in reach", () => {
    const world = newWorld();
    standBeside(world, ELDER);

    const events = step(world, [
      { type: "AcceptQuest", quest: "lost-wanderer" },
    ]);

    expect(events).toContainEqual({
      type: "QuestGiven",
      quest: "lost-wanderer",
    });
    expect(questOf(world, "lost-wanderer").state).toBe("given");
  });

  it("are not Given from out of reach", () => {
    const world = newWorld();

    const events = step(world, [
      { type: "AcceptQuest", quest: "lost-wanderer" },
    ]);

    expect(events).toEqual([]);
    expect(questOf(world, "lost-wanderer").state).toBe("notGiven");
  });

  it("are not Given by an NPC who isn't the giver", () => {
    const world = newWorld(undefined, "mill");
    standBeside(world, MILL_WANDERER);

    step(world, [{ type: "AcceptQuest", quest: "lost-wanderer" }]);

    expect(questOf(world, "lost-wanderer").state).toBe("notGiven");
  });

  it("are Ready once the Wanderer is talked to, even when Not given", () => {
    const world = newWorld(undefined, "mill");

    const events = run(world, [{ type: "Talk", npc: MILL_WANDERER }]);

    expect(events).toContainEqual({
      type: "QuestReady",
      quest: "lost-wanderer",
    });
    expect(questOf(world, "lost-wanderer").state).toBe("ready");
  });

  it("are Ready from Given too", () => {
    const world = newWorld(
      withQuests({ "lost-wanderer": { state: "given", count: 0 } }),
      "mill",
    );

    run(world, [{ type: "Talk", npc: MILL_WANDERER }]);

    expect(questOf(world, "lost-wanderer").state).toBe("ready");
  });

  it("are Done by handing in, giving the reward once", () => {
    const world = newWorld(
      withQuests({ "lost-wanderer": { state: "ready", count: 0 } }),
    );
    standBeside(world, ELDER);

    const events = step(world, [
      { type: "HandInQuest", quest: "lost-wanderer" },
    ]);
    step(world, [{ type: "HandInQuest", quest: "lost-wanderer" }]);

    expect(events).toContainEqual({
      type: "QuestDone",
      quest: "lost-wanderer",
    });
    expect(questOf(world, "lost-wanderer").state).toBe("done");
    expect(world.hero.progress.attributePoints).toBe(5);
  });

  it("can't be handed in before they are Ready", () => {
    const world = newWorld(
      withQuests({ "lost-wanderer": { state: "given", count: 0 } }),
    );
    standBeside(world, ELDER);

    step(world, [{ type: "HandInQuest", quest: "lost-wanderer" }]);

    expect(questOf(world, "lost-wanderer").state).toBe("given");
    expect(world.hero.progress.attributePoints).toBe(0);
  });

  it("can't be Given again once Done", () => {
    const world = newWorld(
      withQuests({ "lost-wanderer": { state: "done", count: 0 } }),
    );
    standBeside(world, ELDER);

    step(world, [{ type: "AcceptQuest", quest: "lost-wanderer" }]);

    expect(questOf(world, "lost-wanderer").state).toBe("done");
  });
});

describe("The Wanderer", () => {
  it("is missing from Town until rescued", () => {
    const world = newWorld();

    expect(npcsIn(world).map(({ name }) => name)).toEqual(["Elder"]);
  });

  it("stands in the Mill until talked to, then is gone from it", () => {
    const world = newWorld(undefined, "mill");
    expect(npcsIn(world).map(({ name }) => name)).toEqual(["Wanderer"]);

    run(world, [{ type: "Talk", npc: MILL_WANDERER }]);

    expect(npcsIn(world)).toEqual([]);
  });

  it("can't be talked to once gone", () => {
    const world = newWorld(undefined, "mill");
    run(world, [{ type: "Talk", npc: MILL_WANDERER }]);

    const events = run(world, [{ type: "Talk", npc: MILL_WANDERER }], 50);

    expect(events.some((event) => event.type === "Talked")).toBe(false);
  });

  it("stands in Town from the next arrival there", () => {
    const world = newWorld(undefined, "mill");
    run(world, [{ type: "Talk", npc: MILL_WANDERER }]);

    run(world, [{ type: "MoveTo", target: { x: 11, y: 1.5 } }], 300);

    expect(world.areaName).toBe("town");
    expect(npcsIn(world).map(({ name }) => name)).toEqual([
      "Elder",
      "Wanderer",
    ]);
    expect(npcsIn(world)[1].id).toBe(TOWN_WANDERER);
  });

  it("stands in Town in a later Session once the Quest is Done", () => {
    const world = newWorld(
      withQuests({ "lost-wanderer": { state: "done", count: 0 } }),
    );

    expect(npcsIn(world).map(({ name }) => name)).toEqual([
      "Elder",
      "Wanderer",
    ]);
  });

  it("is not in the Mill in a later Session once rescued", () => {
    const world = newWorld(
      withQuests({ "lost-wanderer": { state: "ready", count: 0 } }),
      "mill",
    );

    expect(npcsIn(world)).toEqual([]);
  });
});

describe("Quest marks", () => {
  it("show over the giver of a Quest Not given", () => {
    const world = newWorld();

    expect(hasQuestToDeal(world, ELDER)).toBe(true);
  });

  it("show over the giver of a Quest Ready to hand in", () => {
    const world = newWorld(
      withQuests({
        "lost-wanderer": { state: "ready", count: 0 },
        "act-boss": { state: "done", count: 0 },
      }),
    );

    expect(hasQuestToDeal(world, ELDER)).toBe(true);
  });

  it("don't show while the Quests are only Given or Done", () => {
    const world = newWorld(
      withQuests({
        "lost-wanderer": { state: "given", count: 0 },
        "act-boss": { state: "done", count: 0 },
      }),
    );

    expect(hasQuestToDeal(world, ELDER)).toBe(false);
  });

  it("don't show over an NPC who gives no Quest", () => {
    const world = newWorld(undefined, "mill");

    expect(hasQuestToDeal(world, MILL_WANDERER)).toBe(false);
  });
});
