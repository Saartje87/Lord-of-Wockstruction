import { afterEach, describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { townPortalTuning } from "../tuning/townPortal";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import { distance, type Vec } from "./vec";
import {
  areaFade,
  createWorld,
  DEATH_STEPS,
  FRESH_PROGRESS,
  type KeptArea,
  OPENING_STEPS,
  type SimEvent,
  step,
  townPortalFlash,
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

// The cave with two Skeletons, wired up the same way.
const lair = combatArea(
  map(
    [
      "..........", //
      "..........",
      ".H......S.",
      "..........",
      ".....S....",
    ],
    [
      exit(0, 0, "town", "from-cave"),
      entry("from-town", 1, 2),
      exit(0, 4, "den", "from-cave"),
      entry("from-den", 1, 4),
    ],
  ),
);

/** Where the cave's Exit to the den is, and the den's Exit back. */
const TO_DEN = { x: 0.5, y: 4.5 };
const BACK_FROM_DEN = { x: 4.5, y: 2.5 };
/** The cave's two Skeletons as they are on a fresh arrival. */
const FRESH_LAIR = [
  { pos: { x: 8.5, y: 2.5 }, life: 60 },
  { pos: { x: 5.5, y: 4.5 }, life: 60 },
];

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
 * Moves aside any Monster standing on `target`: Monsters block the Hero, and
 * these tests are about where the Hero goes, not about getting past them.
 */
function clearOf(world: World, target: Vec) {
  for (const monster of world.monsters) {
    if (Math.hypot(monster.pos.x - target.x, monster.pos.y - target.y) < 1) {
      monster.pos = { x: monster.pos.x + 2, y: monster.pos.y + 1 };
    }
  }
}

/**
 * Walks the Hero to `target` and steps on until they have arrived in another
 * Area and the change is over, returning every event on the way.
 */
function walkTo(world: World, target: Vec, limit = 600): SimEvent[] {
  clearOf(world, target);
  const events = step(world, [{ type: "MoveTo", target }]);
  for (let i = 0; i < limit; i++) {
    const stepped = step(world, []);
    events.push(...stepped);
    const arrived = events.some((event) => event.type === "AreaChanged");
    if (arrived && !world.areaChange) break;
  }
  return events;
}

/**
 * Walks the Hero to `target`, into an Exit or a Town Portal, and on through
 * the Area change. Returns what the Area they left held as they walked out.
 */
function leave(
  world: World,
  target: Vec,
): Omit<KeptArea, "explored" | "boneAltars" | "goldPiles"> {
  clearOf(world, target);
  step(world, [{ type: "MoveTo", target }]);
  for (let i = 0; i < 600 && !world.areaChange; i++) step(world, []);
  const { monsters, corpses, groundItems, projectiles } = world;
  const left = structuredClone({ monsters, corpses, groundItems, projectiles });
  while (world.areaChange) step(world, []);
  return left;
}

/** The end of the Town Portal in the active Area; throws when there is none. */
function townPortalEnd(world: World): Vec {
  const end = townPortalIn(world);
  if (!end) throw new Error("no Town Portal here");
  return end;
}

/**
 * A World with the Hero in the cave with two Skeletons, the first of them
 * hit once; the Hero has Life to spare and never flinches.
 */
function inLairWithOneHurt(): World {
  heroTuning.flinchChance = 0;
  const w = inCave({ town, cave: lair, den });
  w.hero.life = 1000;
  const [first] = w.monsters;
  for (let i = 0; i < 600; i++) {
    const events = step(w, [{ type: "Attack", monster: first.id }]);
    if (events.some((event) => event.type === "HitLanded")) break;
  }
  expect(first.life).toBeLessThan(60);
  // Let the swing end, so an order isn't held back behind it.
  while (w.hero.swing) step(w, []);
  return w;
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
    expect(w.townPortal).toMatchObject({
      area: "cave",
      pos: { x: 2.5, y: 2.5 },
    });
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
        skillLevels: { ...FRESH_PROGRESS.skillLevels, golem: 1 },
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

  // 350 ms is 21 steps: 10 flashing up, the swap, 10 dying away.
  it("flashes green over 350 ms instead of fading to black", () => {
    const w = inCave();
    open(w);
    step(w, [{ type: "MoveTo", target: { x: 2.5, y: 2.5 } }]);
    while (w.areaChange === null) step(w, []);

    const flashes: number[] = [];
    let arrivedAt = -1;
    for (let i = 1; w.areaChange !== null; i++) {
      const events = step(w, []);
      if (events.some((event) => event.type === "AreaChanged")) arrivedAt = i;
      flashes.push(townPortalFlash(w));
      expect(areaFade(w)).toBe(0);
    }

    expect(flashes).toHaveLength(21);
    expect(arrivedAt).toBe(10);
    expect(flashes[9]).toBe(1);
    expect(flashes.slice(0, 10)).toEqual([...flashes.slice(0, 10)].sort());
    expect(flashes.slice(9)).toEqual([...flashes.slice(9)].sort().reverse());
    expect(flashes[20]).toBe(0);
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
    expect(w.townPortal).toMatchObject({
      area: "cave",
      pos: { x: 2.5, y: 2.5 },
    });
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

describe("the Kept Area", () => {
  it("is just as the Hero left it, back through the Town Portal, however long they were away", () => {
    const w = inLairWithOneHurt();
    open(w);
    const left = leave(w, townPortalEnd(w));
    expect(w.areaName).toBe("town");
    stepFor(w, 600);

    walkTo(w, TOWN_SPOT);

    expect(w.areaName).toBe("cave");
    expect(w.monsters).toEqual(left.monsters);
    expect(w.projectiles).toEqual(left.projectiles);
  });

  it("has a Monster that was chasing the Hero Returning when they come back", () => {
    const w = inLairWithOneHurt();
    open(w);
    const left = leave(w, townPortalEnd(w));
    expect(left.monsters.some(({ state }) => state === "chase")).toBe(false);

    walkTo(w, TOWN_SPOT);

    expect(w.monsters.map(({ state }) => state)).toEqual(["return", "return"]);
    for (let i = 0; i < 1200; i++) {
      if (w.monsters.every(({ state }) => state !== "return")) break;
      step(w, []);
    }
    expect(w.monsters.map(({ life }) => life)).toEqual([60, 60]);
  });

  it("still has its Corpses and Ground Items when the Hero comes back", () => {
    const w = inLairWithOneHurt();
    const [first] = w.monsters;
    for (let i = 0; i < 3000 && w.monsters.includes(first); i++) {
      step(w, [{ type: "Attack", monster: first.id }]);
    }
    while (w.hero.swing) step(w, []);
    step(w, [{ type: "LiftItem", from: "weapon" }, { type: "DropItem" }]);
    open(w);
    const left = leave(w, townPortalEnd(w));
    expect(left.corpses).toHaveLength(1);
    expect(left.groundItems.map(({ item }) => item.type)).toContain(
      "shortSword",
    );

    walkTo(w, TOWN_SPOT);

    expect(w.corpses).toEqual(left.corpses);
    expect(w.groundItems).toEqual(left.groundItems);
  });

  it("is kept when the Hero comes back by an Exit from another Combat Area", () => {
    const w = inLairWithOneHurt();
    open(w);
    const left = leave(w, TO_DEN);
    expect(w.areaName).toBe("den");

    walkTo(w, BACK_FROM_DEN);

    expect(w.areaName).toBe("cave");
    expect(w.monsters).toEqual(left.monsters);
  });

  it("is kept when the Hero comes back from Town by its Exit", () => {
    const w = inLairWithOneHurt();
    open(w);
    const left = leave(w, townPortalEnd(w));

    walkTo(w, { x: 7.5, y: 1.5 });

    expect(w.areaName).toBe("cave");
    expect(w.monsters).toEqual(left.monsters);
  });

  it("lets Monsters that were Returning after a Death finish Returning and heal at home", () => {
    const w = inLairWithOneHurt();
    open(w);
    // Lure the Skeletons far from home, so they're still Returning by the
    // time the Hero is sent back to Town.
    step(w, [{ type: "MoveTo", target: { x: 0.5, y: 2.5 } }]);
    stepFor(w, 120);
    w.hero.life = 1;
    let died = false;
    for (let i = 0; i < 1200 && !died; i++) {
      died = step(w, []).some((event) => event.type === "HeroDied");
    }
    expect(died).toBe(true);
    stepFor(w, DEATH_STEPS);
    step(w, [{ type: "Continue" }]);
    const returning = w.monsters.map(({ state, life }) => ({ state, life }));
    while (w.areaChange) step(w, []);
    expect(w.areaName).toBe("town");
    expect(returning.every(({ state }) => state === "return")).toBe(true);
    expect(returning.some(({ life }) => life < 60)).toBe(true);

    walkTo(w, TOWN_SPOT);
    expect(w.monsters.map(({ state }) => state)).toEqual(["return", "return"]);
    for (let i = 0; i < 1200; i++) {
      if (w.monsters.every(({ state }) => state !== "return")) break;
      step(w, []);
    }

    expect(w.monsters.map(({ state }) => state)).not.toContain("return");
    expect(w.monsters.map(({ life }) => life)).toEqual([60, 60]);
  });

  it("is kept once the Town Portal has closed, and by a later Exit", () => {
    const w = inLairWithOneHurt();
    open(w);
    leave(w, townPortalEnd(w));
    walkTo(w, TOWN_SPOT);
    expect(w.townPortal).toBeNull();
    const left = leave(w, TO_DEN);

    walkTo(w, BACK_FROM_DEN);

    expect(w.areaName).toBe("cave");
    expect(w.monsters).toEqual(left.monsters);
  });

  it("is kept when a Town Portal opens in another Area", () => {
    const w = inLairWithOneHurt();
    open(w);
    const left = leave(w, TO_DEN);
    open(w);
    // Walk round the den's Town Portal, a step east of the Hero.
    step(w, [{ type: "MoveTo", target: { x: 1.5, y: 2.5 } }]);
    stepFor(w, 30);

    walkTo(w, BACK_FROM_DEN);

    expect(w.areaName).toBe("cave");
    expect(w.monsters).toEqual(left.monsters);
  });

  it("is kept without any Town Portal, by Exits alone", () => {
    const w = inLairWithOneHurt();
    const left = leave(w, TO_DEN);

    walkTo(w, BACK_FROM_DEN);

    expect(w.areaName).toBe("cave");
    expect(w.monsters).toEqual(left.monsters);
  });

  it("is kept along with other Areas, all at once", () => {
    const w = inLairWithOneHurt();
    const cave = leave(w, TO_DEN);
    const [skeleton] = w.monsters;
    const denLeft = leave(w, BACK_FROM_DEN);
    expect(w.areaName).toBe("cave");
    expect(w.monsters).toEqual(cave.monsters);

    leave(w, TO_DEN);

    expect(w.areaName).toBe("den");
    expect(w.monsters.map(({ id }) => id)).toEqual([skeleton.id]);
    expect(denLeft.monsters).toHaveLength(1);
  });

  it("starts every Area fresh in a new World", () => {
    const w = inLairWithOneHurt();
    leave(w, TO_DEN);

    const fresh = inCave({ town, cave: lair, den });

    expect(fresh.monsters.map(({ pos, life }) => ({ pos, life }))).toEqual(
      FRESH_LAIR,
    );
  });
});
