import { describe, expect, it } from "vitest";
import { waypointTuning } from "../tuning/waypoints";
import { newMinion } from "./minions";
import { combatArea } from "./testAreas";
import { distance } from "./vec";
import {
  AREA_CHANGE_STEPS,
  createWorld,
  FRESH_PROGRESS,
  type Order,
  type SimEvent,
  step,
  townPortalIn,
  type World,
  waypointList,
  waypointUnderHero,
} from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start`, `W` the Area's Waypoint, `P` the Town Portal's spot and `S` one
 * Skeleton, each in the middle of its tile.
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
    if (cell === "W") all.push({ ...entry("", x, y), type: "waypoint" });
    if (cell === "P") all.push({ ...entry("", x, y), type: "townPortal" });
    if (cell === "S") {
      all.push({
        ...entry("", x, y),
        type: "monsterSpawn",
        properties: [{ name: "monster", type: "string", value: "skeleton" }],
      });
    }
  });
  const layer = (name: string, data: number[]) => ({
    type: "tilelayer",
    name,
    width,
    height,
    data,
  });
  return {
    orientation: "orthogonal",
    width,
    height,
    tilewidth: 32,
    tileheight: 32,
    tilesets: [
      {
        firstgid: 1,
        name: "test",
        tiles: [
          {
            id: 1,
            properties: [{ name: "blocks", type: "bool", value: true }],
          },
        ],
      },
    ],
    layers: [
      layer("floor", new Array(width * height).fill(1)),
      layer(
        "walls & props",
        [...cells].map((cell) => (cell === "#" ? 2 : 0)),
      ),
      { type: "objectgroup", name: "objects", objects: all },
    ],
    properties: [{ name: "act", type: "int", value: 1 }],
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

// Town: the Waypoint is down the left side, the Town Portal's spot to the
// east; the Exit to the cave is on the east edge.
const town = map(
  [
    "........", //
    ".H..P...",
    ".W......",
    "........",
  ],
  [exit(7, 0, "cave", "from-town"), entry("from-cave", 6, 0)],
);
// The cave has a Waypoint and a Skeleton far from it.
const cave = combatArea(
  map(
    [
      "..........", //
      ".H........",
      ".W........",
      "..........",
      "........S.",
    ],
    [exit(0, 0, "town", "from-cave"), entry("from-town", 1, 1)],
  ),
  2,
);
// Another Act: its Waypoint is never on the list.
const otherAct = {
  ...combatArea(map(["....", ".HW.", "...."]), 5),
  properties: [
    { name: "areaLevel", type: "int", value: 5 },
    { name: "act", type: "int", value: 2 },
  ],
};

function newWorld(progress = FRESH_PROGRESS): World {
  return createWorld({
    areas: { town, cave, "other-act": otherAct },
    seed: 1,
    progress,
  });
}

/** Steps `steps` times with `orders` on the first, returning every event. */
function run(world: World, steps: number, orders: Order[] = []): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < steps; i++) {
    events.push(...step(world, i === 0 ? orders : []));
  }
  return events;
}

/** Walks the Hero straight to a tile in the active Area, then stands. */
function walkTo(world: World, x: number, y: number): SimEvent[] {
  const events = run(world, 1, [
    { type: "MoveTo", target: { x: x + 0.5, y: y + 0.5 } },
  ]);
  for (let i = 0; i < 600 && world.hero.path.length > 0; i++) {
    events.push(...step(world, []));
  }
  return events;
}

/** Waits out an Area change. */
function changeAreas(world: World) {
  run(world, AREA_CHANGE_STEPS + 2);
}

/** Puts the Hero on the Waypoint of the active Area. */
function standOnWaypoint(world: World) {
  const spot = world.areas[world.areaName].waypoint;
  if (!spot) throw new Error("no Waypoint");
  world.hero.pos = { ...spot };
  world.hero.prevPos = { ...spot };
}

describe("touching a Waypoint", () => {
  it("is done by walking onto it, once, with an event", () => {
    const world = newWorld({ ...FRESH_PROGRESS, touchedWaypoints: [] });
    expect(world.hero.progress.touchedWaypoints).toEqual([]);
    const events = walkTo(world, 1, 2);
    expect(events.filter((e) => e.type === "WaypointTouched")).toEqual([
      { type: "WaypointTouched", area: "town" },
    ]);
    expect(world.hero.progress.touchedWaypoints).toEqual(["town"]);

    walkTo(world, 3, 3);
    const again = walkTo(world, 1, 2);
    expect(again.filter((e) => e.type === "WaypointTouched")).toEqual([]);
    expect(again.filter((e) => e.type === "WaypointReached")).toEqual([
      { type: "WaypointReached", area: "town" },
    ]);
  });

  it("is already done for Wockville in a fresh Hero", () => {
    expect(newWorld().hero.progress.touchedWaypoints).toEqual(["town"]);
  });

  it("is not done by standing near it", () => {
    const world = newWorld({ ...FRESH_PROGRESS, touchedWaypoints: [] });
    const events = walkTo(world, 3, 2);
    expect(events.some((e) => e.type === "WaypointTouched")).toBe(false);
    expect(waypointUnderHero(world)).toBeNull();
  });

  it("puts the Hero on it for the list to show", () => {
    const world = newWorld();
    walkTo(world, 1, 2);
    expect(waypointUnderHero(world)).toBe("town");
  });
});

describe("the list of Waypoints", () => {
  it("holds the Act's Waypoints in Main Path order, touched or not", () => {
    const world = newWorld();
    expect(waypointList(world)).toEqual([
      { area: "town", touched: true },
      { area: "cave", touched: false },
    ]);
    world.hero.progress.touchedWaypoints.push("cave");
    expect(waypointList(world).map((w) => w.touched)).toEqual([true, true]);
  });
});

describe("the order of the list", () => {
  /** `content` as the `position`th Area of the Act's Main Path, at `level`. */
  const onMainPath = (content: object, position: number, level?: number) => ({
    ...content,
    properties: [
      ...(level === undefined
        ? []
        : [{ name: "areaLevel", type: "int", value: level }]),
      { name: "act", type: "int", value: 1 },
      { name: "mainPath", type: "int", value: position },
    ],
  });

  it("is the Main Path's, whatever the Areas' Levels", () => {
    const world = createWorld({
      areas: {
        town: onMainPath(town, 0),
        // Further along the Main Path, but a lower Area Level.
        far: onMainPath(cave, 2, 3),
        cave: onMainPath(cave, 1, 9),
      },
      seed: 1,
    });
    expect(waypointList(world).map((w) => w.area)).toEqual([
      "town",
      "cave",
      "far",
    ]);
  });

  it("rejects a bad Main Path position, naming the Area", () => {
    expect(() =>
      createWorld({
        areas: { town: onMainPath(town, 0), cave: onMainPath(cave, -1, 2) },
        seed: 1,
      }),
    ).toThrow(/cave/);
  });
});

describe("travelling to a Waypoint", () => {
  const touchedBoth = {
    ...FRESH_PROGRESS,
    touchedWaypoints: ["town", "cave"],
  };

  it("takes the Hero there with the Area change fade, arriving beside it", () => {
    const world = newWorld(touchedBoth);
    standOnWaypoint(world);
    const events = run(world, AREA_CHANGE_STEPS + 2, [
      { type: "TravelToWaypoint", area: "cave" },
    ]);
    expect(world.areaName).toBe("cave");
    expect(events).toContainEqual({
      type: "AreaChanged",
      area: "cave",
      entry: null,
    });
    const spot = world.areas.cave.waypoint;
    const away = distance(world.hero.pos, spot ?? { x: 0, y: 0 });
    expect(away).toBeGreaterThan(waypointTuning.radius);
    expect(away).toBeLessThanOrEqual(waypointTuning.arriveDistance + 0.01);
    // Beside it, so it doesn't open the list or touch again.
    expect(waypointUnderHero(world)).toBeNull();
  });

  it("does not travel to a Waypoint not yet touched", () => {
    const world = newWorld();
    standOnWaypoint(world);
    run(world, AREA_CHANGE_STEPS + 2, [
      { type: "TravelToWaypoint", area: "cave" },
    ]);
    expect(world.areaName).toBe("town");
  });

  it("does not travel from anywhere but a Waypoint", () => {
    const world = newWorld(touchedBoth);
    run(world, AREA_CHANGE_STEPS + 2, [
      { type: "TravelToWaypoint", area: "cave" },
    ]);
    expect(world.areaName).toBe("town");
  });

  it("does not travel to another Act's Waypoint, or to the one it stands on", () => {
    const world = newWorld({
      ...touchedBoth,
      touchedWaypoints: ["town", "cave", "other-act"],
    });
    standOnWaypoint(world);
    run(world, AREA_CHANGE_STEPS + 2, [
      { type: "TravelToWaypoint", area: "other-act" },
      { type: "TravelToWaypoint", area: "town" },
    ]);
    expect(world.areaName).toBe("town");
    expect(world.areaChange).toBeNull();
  });

  it("keeps the Town Portal open and brings the Minions along", () => {
    const world = newWorld(touchedBoth);
    world.townPortal = { area: "cave", pos: { x: 4.5, y: 3.5 } };
    world.minions.push(
      newMinion(1, "golem", "golem", 1, world.hero.pos, world.hero.facing),
    );
    standOnWaypoint(world);
    run(world, AREA_CHANGE_STEPS + 2, [
      { type: "TravelToWaypoint", area: "cave" },
    ]);
    expect(world.areaName).toBe("cave");
    expect(world.townPortal).toEqual({
      area: "cave",
      pos: { x: 4.5, y: 3.5 },
    });
    expect(world.minions.map((minion) => minion.id)).toEqual([1]);
    expect(distance(world.minions[0].pos, world.hero.pos)).toBeLessThan(2);
  });
});

describe("a Waypoint's Area when left", () => {
  it("is kept as it was, as when leaving by an Exit", () => {
    const world = newWorld({
      ...FRESH_PROGRESS,
      touchedWaypoints: ["town", "cave"],
    });
    walkTo(world, 7, 0);
    changeAreas(world);
    expect(world.areaName).toBe("cave");
    const skeleton = world.monsters.length;
    expect(skeleton).toBeGreaterThan(0);
    world.monsters.length = 0;
    world.townPortal = { area: "cave", pos: { x: 4.5, y: 3.5 } };
    standOnWaypoint(world);
    run(world, 1, [{ type: "TravelToWaypoint", area: "town" }]);
    changeAreas(world);
    expect(world.areaName).toBe("town");
    expect(townPortalIn(world)).not.toBeNull();
    standOnWaypoint(world);
    run(world, AREA_CHANGE_STEPS + 2, [
      { type: "TravelToWaypoint", area: "cave" },
    ]);
    expect(world.areaName).toBe("cave");
    expect(world.monsters).toHaveLength(0);
    expect(world.townPortal).not.toBeNull();
  });
});
