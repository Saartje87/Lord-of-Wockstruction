import { afterEach, describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { townPortalTuning } from "../tuning/townPortal";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import { distance, type Vec } from "./vec";
import {
  createWorld,
  DEATH_STEPS,
  FRESH_PROGRESS,
  OPENING_STEPS,
  type SimEvent,
  step,
  townPortalIn,
  type World,
} from "./world";

const { flinchChance } = heroTuning;
afterEach(() => {
  heroTuning.flinchChance = flinchChance;
});

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start`, `S` one Skeleton and `P` the Town Portal's spot in Town, each in
 * the middle of its tile. `objects` adds more, such as Entries and Exits.
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
    if (cell === "S") all.push(skeleton(x, y));
    if (cell === "P") {
      all.push({ ...entry("", x, y), type: "townPortal" });
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

/** One Skeleton's spawn in the middle of tile (x, y). */
function skeleton(x: number, y: number) {
  return {
    ...entry("", x, y),
    type: "monsterSpawn",
    properties: [{ name: "monster", type: "string", value: "skeleton" }],
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

// Town's Town Portal spot stands east of `start`; its Exit, on the east
// edge, leads to the cave's `from-town`, by the cave's west edge.
const town = map(
  [
    "........", //
    ".H..P...",
    "........",
    "........",
  ],
  [exit(7, 1, "cave", "from-town"), entry("from-cave", 6, 1)],
);
const cave = combatArea(
  map(
    [
      "..........", //
      "..........",
      ".H........",
      "..........",
      "..........",
    ],
    [
      exit(0, 0, "town", "from-cave"),
      entry("from-town", 1, 2),
      exit(0, 4, "den", "from-cave"),
      entry("from-den", 1, 4),
    ],
  ),
);
// A Skeleton waits right beside the Hero's arrival.
const den = combatArea(
  map(
    [
      ".....", //
      ".HS..",
      ".....",
    ],
    [exit(4, 2, "cave", "from-den"), entry("from-cave", 1, 1)],
  ),
);
const TOWN_SPOT = { x: 4.5, y: 1.5 };
// A wall two tiles thick right ahead of the Hero's arrival.
const walled = combatArea(
  map(
    [
      "..##......", //
      "..##......",
      ".H##......",
      "..##......",
      "..##......",
    ],
    [exit(0, 0, "town", "from-cave"), entry("from-town", 1, 2)],
  ),
);

/** A World with the Hero just arrived in the cave, facing east along +x. */
function inCave(areas: Record<string, unknown> = { town, cave, den }): World {
  return createWorld({
    areas,
    seed: 1,
    start: { area: "cave", entry: "from-town" },
  });
}

/** Opens a Town Portal and steps until it has opened, returning the events. */
function open(world: World): SimEvent[] {
  return [
    ...step(world, [{ type: "OpenTownPortal" }]),
    ...stepFor(world, OPENING_STEPS),
  ];
}

/**
 * Walks the Hero to `target` and steps on until they have arrived in another
 * Area and the change is over, returning every event on the way.
 */
function walkTo(world: World, target: Vec, limit = 600): SimEvent[] {
  const events = step(world, [{ type: "MoveTo", target }]);
  for (let i = 0; i < limit; i++) {
    const stepped = step(world, []);
    events.push(...stepped);
    const arrived = events.some((event) => event.type === "AreaChanged");
    if (arrived && !world.areaChange) break;
  }
  return events;
}

/** Steps with no orders `count` times, collecting every event. */
function stepFor(world: World, count: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < count; i++) events.push(...step(world, []));
  return events;
}

describe("opening a Town Portal", () => {
  it("opens one a step ahead of the Hero once the opening time has passed", () => {
    const w = inCave();

    const first = step(w, [{ type: "OpenTownPortal" }]);
    const during = stepFor(w, OPENING_STEPS - 1);
    expect([...first, ...during]).toEqual([]);
    expect(townPortalIn(w)).toBeNull();
    const opened = step(w, []);

    expect(opened).toEqual([
      { type: "TownPortalOpened", area: "cave", pos: { x: 2.5, y: 2.5 } },
    ]);
    expect(townPortalIn(w)).toEqual({ x: 2.5, y: 2.5 });
  });

  it("opens it on the nearest walkable spot when a wall stands ahead", () => {
    const w = inCave({ town, cave: walled });

    open(w);

    const at = townPortalIn(w);
    expect(at?.x).toBeCloseTo(1.7);
    expect(at?.y).toBeCloseTo(2.5);
  });

  // Against the wall, it opens over the Hero.
  it("takes the Hero through only once they walk into it, not by standing in it", () => {
    const w = inCave({ town, cave: walled });
    open(w);
    stepFor(w, 60);
    expect(w.areaName).toBe("cave");

    walkTo(w, { x: 1.5, y: 4.5 });
    const events = walkTo(w, { x: 1.7, y: 2.5 });

    expect(events).toContainEqual({
      type: "AreaChanged",
      area: "town",
      entry: null,
    });
  });

  it("roots the Hero while it opens", () => {
    const w = inCave();
    const from = { ...w.hero.pos };

    step(w, [{ type: "OpenTownPortal" }]);
    step(w, [{ type: "MoveTo", target: { x: 8.5, y: 2.5 } }]);
    stepFor(w, 5);

    expect(w.hero.pos).toEqual(from);
  });

  it("does nothing in Town", () => {
    const w = createWorld({ areas: { town, cave, den }, seed: 1 });

    const events = open(w);

    expect(events).toEqual([]);
    expect(w.townPortal).toBeNull();
  });

  it("does nothing during an Area change", () => {
    const w = inCave();
    step(w, [{ type: "MoveTo", target: { x: 0.5, y: 0.5 } }]);
    while (!w.areaChange) step(w, []);

    step(w, [{ type: "OpenTownPortal" }]);
    while (w.areaChange) step(w, [{ type: "OpenTownPortal" }]);
    stepFor(w, OPENING_STEPS);

    expect(w.areaName).toBe("town");
    expect(w.townPortal).toBeNull();
  });

  it("does nothing during Death", () => {
    const w = inCave();
    walkTo(w, { x: 0.5, y: 4.5 });
    w.hero.life = 1;
    let died = false;
    for (let i = 0; i < 600 && !died; i++) {
      died = step(w, []).some((event) => event.type === "HeroDied");
    }
    expect(died).toBe(true);

    const events = open(w);

    expect(events.map((event) => event.type)).not.toContain("TownPortalOpened");
    expect(w.townPortal).toBeNull();
  });

  it("is cancelled by a flinch, leaving the old Town Portal as it was", () => {
    heroTuning.flinchChance = 1;
    const w = inCave();
    open(w);
    walkTo(w, { x: 0.5, y: 4.5 });
    expect(w.areaName).toBe("den");
    // Open just as the Skeleton winds up, so its hit lands while opening.
    for (let i = 0; i < 600 && w.monsters[0].state !== "windup"; i++) {
      step(w, []);
    }

    const events = open(w);
    events.push(...stepFor(w, OPENING_STEPS));

    expect(events.map((event) => event.type)).toContain("HeroHit");
    expect(events.map((event) => event.type)).not.toContain("TownPortalOpened");
    expect(w.townPortal).toEqual({ area: "cave", pos: { x: 2.5, y: 2.5 } });
  });

  it("closes the old Town Portal when another opens", () => {
    const w = inCave();
    open(w);
    step(w, [{ type: "MoveTo", target: { x: 1.5, y: 3.5 } }]);
    stepFor(w, 60);

    const events = open(w);

    expect(events).toEqual([
      { type: "TownPortalClosed", area: "cave", pos: { x: 2.5, y: 2.5 } },
      { type: "TownPortalOpened", area: "cave", pos: { x: 1.5, y: 4.5 } },
    ]);
  });
});

describe("going through a Town Portal", () => {
  it("takes the Hero to Town beside its Town end, with full Life, leaving it open", () => {
    const w = inCave();
    open(w);
    w.hero.life = 10;

    const events = walkTo(w, { x: 2.5, y: 2.5 });

    expect(events).toContainEqual({
      type: "AreaChanged",
      area: "town",
      entry: null,
    });
    expect(w.areaName).toBe("town");
    expect(distance(w.hero.pos, TOWN_SPOT)).toBeCloseTo(
      townPortalTuning.arriveDistance,
    );
    expect(w.hero.life).toBe(100);
    expect(townPortalIn(w)).toEqual(TOWN_SPOT);
    expect(events.map((event) => event.type)).not.toContain("TownPortalClosed");
  });

  it("takes the Hero back beside its Combat Area end from Town, closing it", () => {
    const w = inCave();
    open(w);
    walkTo(w, { x: 2.5, y: 2.5 });

    const events = walkTo(w, TOWN_SPOT);

    expect(events).toContainEqual({
      type: "AreaChanged",
      area: "cave",
      entry: null,
    });
    expect(events).toContainEqual({
      type: "TownPortalClosed",
      area: "cave",
      pos: { x: 2.5, y: 2.5 },
    });
    expect(w.areaName).toBe("cave");
    expect(distance(w.hero.pos, { x: 2.5, y: 2.5 })).toBeCloseTo(
      townPortalTuning.arriveDistance,
    );
    expect(w.townPortal).toBeNull();
    expect(townPortalIn(w)).toBeNull();
  });

  it("brings the Hero's Minion along both ways", () => {
    const w = createWorld({
      areas: { town, cave, den },
      seed: 1,
      start: { area: "cave", entry: "from-town" },
      progress: {
        ...FRESH_PROGRESS,
        skillLevels: { golem: 1 },
        skillBar: { ...emptySkillBar(), right: "golem" },
      },
    });
    step(w, [{ type: "Cast", slot: "right", target: { x: 1.5, y: 4.5 } }]);
    stepFor(w, 60);
    open(w);
    const minions = w.minions.map((minion) => minion.id);
    expect(minions).toHaveLength(1);
    const townPortal = townPortalIn(w);
    if (!townPortal) throw new Error("no Town Portal opened");

    walkTo(w, townPortal);
    expect(w.areaName).toBe("town");
    expect(w.minions.map((minion) => minion.id)).toEqual(minions);
    for (const minion of w.minions) {
      expect(distance(minion.pos, w.hero.pos)).toBeLessThan(2);
    }

    walkTo(w, TOWN_SPOT);
    expect(w.areaName).toBe("cave");
    expect(w.minions.map((minion) => minion.id)).toEqual(minions);
  });

  it("lets no Monster through", () => {
    const w = inCave();
    walkTo(w, { x: 0.5, y: 4.5 });
    open(w);
    const townPortal = townPortalIn(w);
    if (!townPortal) throw new Error("no Town Portal opened");
    w.hero.life = 1000;

    walkTo(w, townPortal);

    expect(w.areaName).toBe("town");
    expect(w.monsters).toEqual([]);
    expect(w.projectiles).toEqual([]);
  });
});

describe("the Town Portal stays open", () => {
  it("after leaving its Area by an Exit", () => {
    const w = inCave();
    open(w);

    const events = walkTo(w, { x: 0.5, y: 4.5 });

    expect(w.areaName).toBe("den");
    expect(events.map((event) => event.type)).not.toContain("TownPortalClosed");
    expect(townPortalIn(w)).toBeNull();
    expect(w.townPortal).toEqual({ area: "cave", pos: { x: 2.5, y: 2.5 } });
  });

  it("after Death's way back to Town", () => {
    const w = inCave();
    open(w);
    walkTo(w, { x: 0.5, y: 4.5 });
    w.hero.life = 1;
    let died = false;
    for (let i = 0; i < 600 && !died; i++) {
      died = step(w, []).some((event) => event.type === "HeroDied");
    }
    stepFor(w, DEATH_STEPS);

    step(w, [{ type: "Continue" }]);
    while (w.areaChange) step(w, []);

    expect(w.areaName).toBe("town");
    expect(townPortalIn(w)).toEqual(TOWN_SPOT);
  });
});

describe("a World built from the Save", () => {
  it("starts in Town with no Town Portal", () => {
    const w = createWorld({
      areas: { town, cave, den },
      seed: 1,
      progress: FRESH_PROGRESS,
    });

    expect(w.areaName).toBe("town");
    expect(w.townPortal).toBeNull();
    expect(townPortalIn(w)).toBeNull();
  });
});
