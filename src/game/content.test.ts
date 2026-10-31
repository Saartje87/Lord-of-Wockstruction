import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  areaDisplayNames,
  areas,
  createShippedWorld,
  tilesets,
} from "./content";
import { encodeSave, parseSave, saveOf } from "./save";
import { type Area, type Exit, isWalkable, type Spawn } from "./sim/area";
import { fightUniqueAlone } from "./sim/fightReport";
import { type MonsterOfLevel, monsterExperience } from "./sim/monsters";
import { canReach, findPath } from "./sim/path";
import { STEPS_PER_SECOND } from "./sim/units";
import { validateActs, validateQuests } from "./sim/validate";
import { distance, type Vec } from "./sim/vec";
import {
  createWorld,
  FRESH_PROGRESS,
  levelExperience,
  npcsIn,
  type Order,
  questOf,
  type SimEvent,
  step,
  type World,
  waypointList,
  waypointUnderHero,
} from "./sim/world";
import { ITEM_TYPES, itemOf } from "./tuning/items";
import { type MonsterType, monsterTuning } from "./tuning/monsters";
import { questTuning } from "./tuning/quests";
import { LOOKS, outdoorLookOf } from "./world3d/toon";
import { pondsOf } from "./world3d/waterMeshes";

// Building the World runs the loader's validation: a `start` Entry, Exits to
// an Entry that exists and can be reached from `start`, and spawns on tiles
// Monsters can stand on.
const shippedWorld = () => createWorld({ areas, tilesets, seed: 1 });

/**
 * Whether a Monster is as strong as one of its type at `monsterLevel`, by the
 * Experience it's worth, which differs at every Monster Level.
 */
const isAtMonsterLevel = (monsterLevel: number) => (monster: MonsterOfLevel) =>
  monsterExperience({
    type: monster.type,
    monsterLevel: monster.monsterLevel,
  }) === monsterExperience({ type: monster.type, monsterLevel });

/**
 * The shipped Areas with a stand-in Town of three floor tiles, whose one
 * Exit, two tiles from `start`, leads to `entry` in `area`; with the Hero
 * just arrived there. It saves walking past every Monster above.
 */
function worldEntering(area: string, entry: string): World {
  const town = {
    orientation: "orthogonal",
    width: 3,
    height: 1,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      { type: "tilelayer", name: "floor", data: [1, 1, 1] },
      {
        type: "objectgroup",
        name: "objects",
        objects: [
          { name: "start", type: "entry", x: 16, y: 16 },
          { name: "from-cozy-plains", type: "entry", x: 16, y: 16 },
          {
            name: "",
            type: "exit",
            x: 64,
            y: 0,
            width: 32,
            height: 32,
            properties: [
              { name: "area", type: "string", value: area },
              { name: "entry", type: "string", value: entry },
            ],
          },
        ],
      },
    ],
  };
  const world = createWorld({
    areas: { ...areas, town },
    tilesets,
    seed: 1,
  });
  walkThrough(world, world.areas.town.exits[0]);
  expect(world.areaName).toBe(area);
  return world;
}

/**
 * Like `walkThrough`, but swinging at any Monster within `reach` tiles on
 * the way, as a player would at a pack blocking the path, and heading for
 * the Exit again once none is.
 */
function fightThrough(world: World, exit: Exit, reach = 2) {
  let changed: Extract<SimEvent, { type: "AreaChanged" }> | null = null;
  const distance = (pos: Vec) =>
    Math.hypot(pos.x - world.hero.pos.x, pos.y - world.hero.pos.y);
  for (let i = 0; i < 5 * 60 * 60 && !(changed && !world.areaChange); i++) {
    let orders: Order[] = [];
    if (!changed && i % 15 === 0) {
      const [nearest] = world.monsters
        .filter((monster) => monster.life > 0 && distance(monster.pos) < reach)
        .sort((a, b) => distance(a.pos) - distance(b.pos));
      orders = nearest
        ? [{ type: "Attack", monster: nearest.id }]
        : [{ type: "MoveTo", target: centreOf(exit) }];
    }
    for (const event of step(world, orders)) {
      if (event.type === "AreaChanged") changed = event;
    }
  }
  return changed;
}

/** The longest a leg of the Hero's walk across the shipped Areas may take: the slowest is about 0.1s alone. */
const LEG_TIMEOUT_MS = 3_000;

/** An Area's one Exit to Area `to`; throws when it has none or several. */
function exitTo(area: Area, to: string): Exit {
  const exits = area.exits.filter((exit) => exit.area === to);
  if (exits.length !== 1) {
    throw new Error(`Area "${area.name}" has ${exits.length} Exits to "${to}"`);
  }
  return exits[0];
}

/** How far the Hero stands from the centre of an Exit, in tiles. */
function heroDistanceTo(world: World, exit: Exit) {
  const centre = centreOf(exit);
  return Math.hypot(world.hero.pos.x - centre.x, world.hero.pos.y - centre.y);
}

/** How many Monsters each of an Area's `monster` Spawns places. */
const packsOf = (area: Area, monster: MonsterType) =>
  area.spawns
    .filter((spawn) => spawn.monster === monster)
    .map((spawn) => spawn.count);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** The Combat Area that Wockville's one Exit leads to. */
const combatAreaOf = (world: World) =>
  world.areas[world.areas.town.exits[0].area];

/** The centre of an Exit's zone. */
const centreOf = (exit: Exit) => ({
  x: exit.x + exit.width / 2,
  y: exit.y + exit.height / 2,
});

/** Expects `value` to be `about` give or take `slack`. */
function expectAbout(value: number, about: number, slack: number) {
  expect(value).toBeGreaterThanOrEqual(about - slack);
  expect(value).toBeLessThanOrEqual(about + slack);
}

/**
 * Walks the Hero into an Exit, stepping until they have arrived in another
 * Area and the fade is over, or `maxSteps` pass. Returns the `AreaChanged`
 * event, if any.
 */
function walkThrough(world: World, exit: Exit, maxSteps = 60 * 60) {
  let changed: Extract<SimEvent, { type: "AreaChanged" }> | null = null;
  step(world, [{ type: "MoveTo", target: centreOf(exit) }]);
  for (let i = 0; i < maxSteps && !(changed && !world.areaChange); i++) {
    for (const event of step(world, [])) {
      if (event.type === "AreaChanged") changed = event;
    }
  }
  return changed;
}

describe("the shipped Areas", () => {
  it("build a World that passes validation", () => {
    const world = shippedWorld();

    expect(Object.keys(world.areas).sort()).toEqual(Object.keys(areas).sort());
  });

  it("each have a display name for the Area Banner on arriving, with no Level in it", () => {
    expect(Object.keys(areaDisplayNames).sort()).toEqual(
      Object.keys(areas).sort(),
    );
    expect(areaDisplayNames.town).toBe("Wockville");
    expect(areaDisplayNames["cozy-plains"]).toBe("Cozy Plains");
    expect(areaDisplayNames["soggy-bog"]).toBe("Soggy Bog");
    expect(areaDisplayNames.wockyard).toBe("Wockyard");
    expect(areaDisplayNames.spa).toBe("Spa");
    expect(areaDisplayNames["old-mill"]).toBe("Old Mill");
    expect(areaDisplayNames.catacombs).toBe("Catacombs");
    expect(areaDisplayNames.crypt).toBe("Crypt");
    for (const name of Object.values(areaDisplayNames)) {
      expect(name).not.toMatch(/level|\d/i);
    }
  });

  it("start the Hero at `start` in a Town of about 32×32, with NPCs and no Monsters", () => {
    const world = shippedWorld();
    const town = world.areas.town;

    expect(world.areaName).toBe("town");
    expect(world.hero.pos).toEqual({ x: 15.5, y: 16.5 });
    expectAbout(town.width, 32, 4);
    expectAbout(town.height, 32, 4);
    expect(town.npcs.length).toBeGreaterThan(0);
    expect(town.spawns).toEqual([]);
    expect(world.monsters).toEqual([]);
  });

  it("put Town's Town Portal spot a few steps from `start`", () => {
    const town = shippedWorld().areas.town;

    if (!town.townPortal) throw new Error("Town has no Town Portal spot");
    expect(
      Math.hypot(
        town.townPortal.x - town.entries.start.x,
        town.townPortal.y - town.entries.start.y,
      ),
    ).toBeLessThan(4);
  });

  it("block Town's trees and buildings", () => {
    const town = shippedWorld().areas.town;
    const blocking = town.props.filter((prop) => prop.blocks);

    expect(blocking.some((prop) => prop.piece.includes("tree"))).toBe(true);
    expect(blocking.some((prop) => prop.piece.startsWith("hexagon/"))).toBe(
      true,
    );
    for (const prop of blocking) {
      expect(town.walkable[prop.y * town.width + prop.x]).toBe(false);
    }
  });

  it("lead from Wockville through one Exit to the Cozy Plains, a Combat Area of about 64×64", () => {
    const world = shippedWorld();
    const combat = combatAreaOf(world);

    expect(world.areas.town.exits).toHaveLength(1);
    expect(combat.name).toBe("cozy-plains");
    expectAbout(combat.width, 64, 8);
    expectAbout(combat.height, 64, 8);
  });

  it("carry Act 1 on every Area, and the open sky only on the outdoor Areas", () => {
    const shipped = Object.values(shippedWorld().areas);

    for (const area of shipped) expect(area.act).toBe(1);
    expect(
      shipped.filter((area) => area.outdoors).map((area) => area.name),
    ).toEqual(["cozy-plains", "soggy-bog", "wockyard", "spa", "old-mill"]);
  });

  it("give the Cozy Plains Area Level 1, Wockwolf, Skeleton and Zombie groups, and its Exits to Wockville and the Soggy Bog", () => {
    const world = worldEntering("cozy-plains", "from-town");
    const plains = world.areas["cozy-plains"];
    const packs = [
      ...packsOf(plains, "wockwolf"),
      ...packsOf(plains, "skeleton"),
      ...packsOf(plains, "zombie"),
    ];

    expect(plains.areaLevel).toBe(1);
    expect(packs).toHaveLength(plains.spawns.length);
    expect(packsOf(plains, "zombie").length).toBeGreaterThan(0);
    expect(world.monsters.every(isAtMonsterLevel(1))).toBe(true);
    expect(exitTo(plains, "town").entry).toBe("from-cozy-plains");
    expect(exitTo(plains, "soggy-bog").entry).toBe("from-cozy-plains");
    expect(plains.exits.map((exit) => exit.area).sort()).toEqual([
      "soggy-bog",
      "spa",
      "town",
    ]);
  });

  it("arrive in the Cozy Plains next to its Exit back to Wockville, and in Wockville next to its Exit", () => {
    const world = shippedWorld();
    const arrived = walkThrough(world, exitTo(world.areas.town, "cozy-plains"));

    expect(arrived?.area).toBe("cozy-plains");
    const back = exitTo(world.areas["cozy-plains"], "town");
    expect(heroDistanceTo(world, back)).toBeLessThan(4);
    walkThrough(world, back);
    expect(world.areaName).toBe("town");
    expect(
      heroDistanceTo(world, exitTo(world.areas.town, "cozy-plains")),
    ).toBeLessThan(4);
  });

  it("lead from the Cozy Plains to the Soggy Bog, arriving next to their Exit back", () => {
    const world = worldEntering("cozy-plains", "from-soggy-bog");
    const onward = exitTo(world.areas["cozy-plains"], "soggy-bog");

    expect(heroDistanceTo(world, onward)).toBeLessThan(4);
    const arrived = walkThrough(world, onward);

    expect(arrived?.area).toBe("soggy-bog");
    expect(
      heroDistanceTo(world, exitTo(world.areas["soggy-bog"], "cozy-plains")),
    ).toBeLessThan(4);
  });

  it("lead from the Soggy Bog to the Wockyard, arriving next to their Exit back", () => {
    const world = worldEntering("soggy-bog", "from-wockyard");
    const onward = exitTo(world.areas["soggy-bog"], "wockyard");

    expect(heroDistanceTo(world, onward)).toBeLessThan(4);
    const arrived = walkThrough(world, onward);

    expect(arrived?.area).toBe("wockyard");
    expect(
      heroDistanceTo(world, exitTo(world.areas.wockyard, "soggy-bog")),
    ).toBeLessThan(4);
  });

  it("lead from the Wockyard down to the Catacombs, arriving next to their Exit back up", () => {
    const world = worldEntering("wockyard", "from-catacombs");
    const onward = exitTo(world.areas.wockyard, "catacombs");

    expect(heroDistanceTo(world, onward)).toBeLessThan(4);
    const arrived = walkThrough(world, onward);

    expect(arrived?.area).toBe("catacombs");
    expect(
      heroDistanceTo(world, exitTo(world.areas.catacombs, "wockyard")),
    ).toBeLessThan(4);
  });

  it("give the Main Path's Areas their Area Levels and link the Catacombs only to the Wockyard and the Crypt", () => {
    const { areas: shipped } = shippedWorld();
    const levels = [
      "cozy-plains",
      "soggy-bog",
      "wockyard",
      "catacombs",
      "crypt",
      "ossuary",
    ].map((name) => shipped[name].areaLevel);

    expect(levels).toEqual([1, 3, 5, 7, 9, 11]);
    expect(shipped.town.areaLevel).toBeNull();
    expect(exitTo(shipped.catacombs, "wockyard").entry).toBe("from-catacombs");
    expect(shipped.catacombs.exits.map((exit) => exit.area).sort()).toEqual([
      "crypt",
      "wockyard",
    ]);
  });

  it.each([
    ["cozy-plains", "spa", 2],
    ["soggy-bog", "old-mill", 4],
  ])("link the %s to a Side Area, the %s, of Area Level %i, arriving next to their Exit back", (parent, side, level) => {
    const world = worldEntering(parent, `from-${side}`);
    const onward = exitTo(world.areas[parent], side);

    expect(world.areas[side].areaLevel).toBe(level);
    expect(world.areas[side].act).toBe(1);
    expect(onward.entry).toBe(`from-${parent}`);
    expect(world.areas[side].exits.map((exit) => exit.area)).toEqual([parent]);
    expect(heroDistanceTo(world, onward)).toBeLessThan(4);
    const arrived = walkThrough(world, onward);

    expect(arrived?.area).toBe(side);
    expect(world.monsters.length).toBeGreaterThan(0);
    expect(world.monsters.every(isAtMonsterLevel(level))).toBe(true);
    const back = exitTo(world.areas[side], parent);
    expect(heroDistanceTo(world, back)).toBeLessThan(4);
    walkThrough(world, back);
    expect(world.areaName).toBe(parent);
    expect(heroDistanceTo(world, onward)).toBeLessThan(4);
  });

  it("let the Hero walk each outdoor Area from its entry to its Exits", () => {
    for (const [name, entry] of [
      ["spa", "from-cozy-plains"],
      ["old-mill", "from-soggy-bog"],
      ["cozy-plains", "from-town"],
      ["soggy-bog", "from-cozy-plains"],
      ["wockyard", "from-soggy-bog"],
    ]) {
      const world = worldEntering(name, entry);
      const area = world.areas[name];

      for (const exit of area.exits) {
        expect(
          findPath(area, world.hero.pos, centreOf(exit), 0.3).length,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("make Zombies and Skeletons more and more of the outdoor Areas the closer they are to the Wockyard", () => {
    const { areas: shipped } = shippedWorld();
    const undead = (name: string) =>
      sum(
        shipped[name].spawns
          .filter((s) => ["zombie", "skeleton"].includes(s.monster))
          .map((s) => s.count),
      );
    const plains = undead("cozy-plains");
    const bog = undead("soggy-bog");
    const yard = undead("wockyard");

    expect(plains).toBeLessThan(bog);
    expect(bog).toBeLessThan(yard);
    for (const name of ["cozy-plains", "soggy-bog", "wockyard"]) {
      expect(packsOf(shipped[name], "zombie").length).toBeGreaterThan(0);
      expect(packsOf(shipped[name], "skeleton").length).toBeGreaterThan(0);
    }
  });

  it("raise graves in the Wockyard", () => {
    const yard = shippedWorld().areas.wockyard;
    const graves = yard.props.filter((prop) => /grave/.test(prop.piece));

    expect(graves.length).toBeGreaterThan(10);
  });

  it("spawn each outdoor Area's Monsters at its Monster Level", () => {
    for (const [name, entry, level] of [
      ["soggy-bog", "from-cozy-plains", 3],
      ["wockyard", "from-soggy-bog", 5],
    ] as const) {
      const world = worldEntering(name, entry);

      expect(world.monsters.length).toBeGreaterThan(0);
      expect(world.monsters.every(isAtMonsterLevel(level))).toBe(true);
    }
  });

  it("fill the Catacombs with 3–4 Skeleton groups, one about 7 strong, and 1–2 Zombie groups", () => {
    const combat = shippedWorld().areas.catacombs;
    const skeletons = packsOf(combat, "skeleton");
    const zombies = packsOf(combat, "zombie");

    expect(skeletons.length + zombies.length).toBe(combat.spawns.length);
    expectAbout(skeletons.length, 3.5, 0.5);
    expect(skeletons.some((count) => Math.abs(count - 7) <= 1)).toBe(true);
    expectAbout(zombies.length, 1.5, 0.5);
  });

  it("place Zombies in the Catacombs once the Hero gets there", () => {
    const world = worldEntering("catacombs", "from-wockyard");

    expect(world.areaName).toBe("catacombs");
    expect(world.monsters.some((monster) => monster.type === "zombie")).toBe(
      true,
    );
  });

  it("give the Catacombs Area Level 7, so its Monsters spawn at Monster Level 7", () => {
    const world = worldEntering("catacombs", "from-wockyard");

    expect(world.areas.town.areaLevel).toBeNull();
    expect(world.areas.catacombs.areaLevel).toBe(7);
    expect(world.areaName).toBe("catacombs");
    expect(world.monsters.length).toBeGreaterThan(0);
    expect(world.monsters.every(isAtMonsterLevel(7))).toBe(true);
  });

  it("lead from the Catacombs down to the Crypt, arriving next to its Exit back up", () => {
    const world = worldEntering("catacombs", "from-crypt");
    const down = exitTo(world.areas.catacombs, "crypt");

    expect(heroDistanceTo(world, down)).toBeLessThan(4);
    const arrived = walkThrough(world, down);

    expect(arrived?.area).toBe("crypt");
    const up = exitTo(world.areas.crypt, "catacombs");
    expect(heroDistanceTo(world, up)).toBeLessThan(4);
  });

  it("lead from the Crypt back up to the Catacombs, arriving next to its Exit down", () => {
    const world = worldEntering("crypt", "start");
    const up = exitTo(world.areas.crypt, "catacombs");

    expect(heroDistanceTo(world, up)).toBeLessThan(4);
    const arrived = walkThrough(world, up);

    expect(arrived?.area).toBe("catacombs");
    const down = exitTo(world.areas.catacombs, "crypt");
    expect(heroDistanceTo(world, down)).toBeLessThan(4);
  });

  it("give the Crypt Area Level 9, so its Monsters spawn at Monster Level 9", () => {
    const world = worldEntering("crypt", "start");

    expect(world.areas.crypt.areaLevel).toBe(9);
    expect(world.monsters.length).toBeGreaterThan(0);
    expect(world.monsters.every(isAtMonsterLevel(9))).toBe(true);
  });

  it("build the Crypt about the Catacombs' size, with somewhat bigger Skeleton packs", () => {
    const { catacombs, crypt } = shippedWorld().areas;
    const shallower = packsOf(catacombs, "skeleton");
    const deeper = packsOf(crypt, "skeleton");

    expectAbout(crypt.width, catacombs.width, 8);
    expectAbout(crypt.height, catacombs.height, 8);
    expect(
      crypt.spawns.every((s) =>
        ["skeleton", "skeleton_archer"].includes(s.monster),
      ),
    ).toBe(true);
    expect(Math.max(...deeper)).toBeGreaterThan(Math.max(...shallower));
    expect(sum(deeper) / deeper.length).toBeGreaterThan(
      sum(shallower) / shallower.length,
    );
    // Somewhat bigger, not a horde.
    expect(sum(deeper)).toBeLessThan(sum(shallower) * 2);
  });
  it("lay the Crypt out as Skeleton packs with Skeleton Archers close behind most of them, and no Zombies", () => {
    const { crypt } = shippedWorld().areas;
    const skeletons = crypt.spawns.filter((s) => s.monster === "skeleton");
    const archers = crypt.spawns.filter((s) => s.monster === "skeleton_archer");
    const gap = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
    const backed = skeletons.filter((skeleton) =>
      archers.some((archer) => gap(archer.pos, skeleton.pos) <= 6),
    );

    expect(packsOf(crypt, "zombie")).toEqual([]);
    expect(skeletons.length + archers.length).toBe(crypt.spawns.length);
    expect(backed.length).toBeGreaterThanOrEqual(skeletons.length - 1);
    // Each Archer Spawn backs a pack, rather than standing alone, and stays
    // beyond the Skeletons' 1.5-tile spreadRadius, noticing the Hero itself.
    for (const archer of archers) {
      const nearest = Math.min(
        ...skeletons.map((skeleton) => gap(archer.pos, skeleton.pos)),
      );
      expect(nearest).toBeLessThanOrEqual(6);
      expect(nearest).toBeGreaterThan(1.5);
    }
  });

  it("teach one new Monster type per Combat Area: Zombies in the Catacombs, Skeleton Archers in the Crypt, and all three in the Ossuary", () => {
    const { catacombs, crypt, ossuary } = shippedWorld().areas;
    const typesIn = (area: Area) =>
      [...new Set(area.spawns.map((spawn) => spawn.monster))].sort();

    expect(typesIn(catacombs)).toEqual(["skeleton", "zombie"]);
    expect(typesIn(crypt)).toEqual(["skeleton", "skeleton_archer"]);
    expect(typesIn(ossuary)).toEqual(["skeleton", "skeleton_archer", "zombie"]);
  });

  it("place Skeleton Archers in the Crypt once the Hero gets there", () => {
    const world = worldEntering("crypt", "start");

    expect(
      world.monsters.some((monster) => monster.type === "skeleton_archer"),
    ).toBe(true);
  });

  it("give the Ossuary Area Level 11 and only an Exit back up to the Crypt", () => {
    const { ossuary } = shippedWorld().areas;

    expect(ossuary.areaLevel).toBe(11);
    expect(ossuary.exits).toHaveLength(1);
    expect(exitTo(ossuary, "crypt").entry).toBe("from-ossuary");
  });
  it("lead from the Crypt down to the Ossuary, arriving next to its Exit back up", () => {
    const world = worldEntering("crypt", "from-ossuary");
    const down = exitTo(world.areas.crypt, "ossuary");

    expect(heroDistanceTo(world, down)).toBeLessThan(4);
    const arrived = walkThrough(world, down);

    expect(arrived?.area).toBe("ossuary");
    const up = exitTo(world.areas.ossuary, "crypt");
    expect(heroDistanceTo(world, up)).toBeLessThan(4);
  });

  it("lead from the Ossuary back up to the Crypt, arriving next to its Exit down", () => {
    const world = worldEntering("ossuary", "start");
    const up = exitTo(world.areas.ossuary, "crypt");

    expect(heroDistanceTo(world, up)).toBeLessThan(4);
    const arrived = walkThrough(world, up);

    expect(arrived?.area).toBe("crypt");
    const down = exitTo(world.areas.crypt, "ossuary");
    expect(heroDistanceTo(world, down)).toBeLessThan(4);
  });

  it("spawn the Ossuary's Monsters at Monster Level 11", () => {
    const world = worldEntering("ossuary", "start");

    expect(world.monsters.length).toBeGreaterThan(0);
    expect(world.monsters.every(isAtMonsterLevel(11))).toBe(true);
  });

  it("build the Ossuary about the Catacombs' size, with more Monsters than the Crypt", () => {
    const { catacombs, crypt, ossuary } = shippedWorld().areas;
    const monsters = (area: Area) => sum(area.spawns.map((s) => s.count));

    expectAbout(ossuary.width, catacombs.width, 8);
    expectAbout(ossuary.height, catacombs.height, 8);
    expect(monsters(ossuary)).toBeGreaterThan(monsters(crypt));
    // Somewhat more, not a horde.
    expect(monsters(ossuary)).toBeLessThan(monsters(crypt) * 2);
  });

  it("lay the Ossuary out as Skeleton packs with Zombies in front and Skeleton Archers behind, as the Hero comes in", () => {
    const { ossuary } = shippedWorld().areas;
    const start = ossuary.entries.start;
    const spawnsOf = (monster: MonsterType) =>
      ossuary.spawns.filter((s) => s.monster === monster);
    const gap = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
    /** How far the Hero walks from `start` to `to`, around walls. */
    const walk = (to: Vec) => {
      let at = start;
      let length = 0;
      for (const point of findPath(ossuary, start, to, 0.3)) {
        length += gap(at, point);
        at = point;
      }
      return length;
    };
    const nearest = (to: Vec, spawns: Spawn[]) =>
      spawns.reduce((a, b) => (gap(a.pos, to) <= gap(b.pos, to) ? a : b));

    for (const skeletons of spawnsOf("skeleton")) {
      const zombies = nearest(skeletons.pos, spawnsOf("zombie"));
      const archers = nearest(skeletons.pos, spawnsOf("skeleton_archer"));

      // Close enough to be one pack, beyond the 1.5-tile spreadRadius.
      for (const spawn of [zombies, archers]) {
        expect(gap(spawn.pos, skeletons.pos)).toBeGreaterThan(1.5);
        expect(gap(spawn.pos, skeletons.pos)).toBeLessThanOrEqual(6);
      }
      expect(walk(zombies.pos)).toBeLessThan(walk(skeletons.pos));
      expect(walk(archers.pos)).toBeGreaterThan(walk(skeletons.pos));
    }
  });

  describe("let the Hero walk from Wockville across the Cozy Plains, the Soggy Bog and the Wockyard and down through the Catacombs and the Crypt to the Ossuary, and back up to Wockville", () => {
    // Sturdy and strong enough to fight through every pack on the way.
    const progress = { ...FRESH_PROGRESS, strength: 200, vitality: 1000 };
    const world = createWorld({
      areas,
      tilesets,
      seed: 1,
      progress,
    });
    const route: [from: string, to: string][] = [
      ["town", "cozy-plains"],
      ["cozy-plains", "soggy-bog"],
      ["soggy-bog", "wockyard"],
      ["wockyard", "catacombs"],
      ["catacombs", "crypt"],
      ["crypt", "ossuary"],
      ["ossuary", "crypt"],
      ["crypt", "catacombs"],
      ["catacombs", "wockyard"],
      ["wockyard", "soggy-bog"],
      ["soggy-bog", "cozy-plains"],
      ["cozy-plains", "town"],
    ];

    // The legs run in order on one World, so each starts where the last ended.
    // Each is a test of its own, so a failure names the leg; the slowest
    // takes about 0.1s, and the timeout leaves room for a loaded machine.
    it.each(route)(
      "from %s to %s",
      (from, to) => {
        expect(world.areaName).toBe(from);
        const arrived = fightThrough(world, exitTo(world.areas[from], to));
        expect(arrived?.area).toBe(to);
      },
      LEG_TIMEOUT_MS,
    );
  });
});

describe("the Item types", () => {
  it("each have a Short name, as the spec lists them", () => {
    const shortNames = Object.fromEntries(
      ITEM_TYPES.map((type) => [itemOf(type).name, itemOf(type).shortName]),
    );

    expect(shortNames).toEqual({
      "Short Sword": "Sword",
      Axe: "Axe",
      "Leather Armour": "Leather",
      "Chain Mail": "Chain",
      "Leather Cap": "Cap",
      "Iron Helm": "Helm",
      "Leather Gloves": "Gloves",
      "Chain Gloves": "Chain",
      "Leather Boots": "Boots",
      "Chain Boots": "Chain",
      Buckler: "Buckler",
      "Tower Shield": "Tower",
      "Bone Wand": "Bone",
      "Yew Wand": "Yew",
      Ring: "Ring",
      Amulet: "Amulet",
      Sash: "Sash",
      "Heavy Belt": "Heavy",
      "Plated Belt": "Plated",
      "Life Potion": "Life",
      "Mana Potion": "Mana",
      "Rejuvenation Potion": "Rejuv",
    });
  });
});

describe("the shipped Areas' pieces", () => {
  const names = [
    "town",
    "cozy-plains",
    "soggy-bog",
    "wockyard",
    "spa",
    "old-mill",
    "catacombs",
    "crypt",
    "ossuary",
  ];
  const kaykit = (name: string) => shippedWorld().areas[name];

  it.each(
    names,
  )("%s knows a piece for every floor cell, and its Walls and Props", (name) => {
    const area = kaykit(name);

    area.floor.forEach((hasFloor, i) => {
      expect(area.floorPieces[i] !== null).toBe(hasFloor);
    });
    expect(area.walls.length).toBeGreaterThan(0);
    expect(area.props.length).toBeGreaterThan(0);
    for (const wall of area.walls) expect(wall.blocks).toBe(true);
    // A blocking Prop stands on floor and stops the Hero.
    for (const prop of area.props.filter((prop) => prop.blocks)) {
      expect(area.floor[prop.y * area.width + prop.x]).toBe(true);
      expect(area.walkable[prop.y * area.width + prop.x]).toBe(false);
    }
  });

  it("gives Town graveyard Props and village buildings", () => {
    const pieces = [...kaykit("town").props.map((prop) => prop.piece)];

    expect(pieces.some((piece) => piece.startsWith("halloween/"))).toBe(true);
    expect(pieces.some((piece) => piece.startsWith("hexagon/"))).toBe(true);
  });
});

describe("the shipped Areas' trails", () => {
  const STONE_PATH = /^halloween\/path_/;
  const pathsIn = (area: Area) =>
    area.floorPieces.filter((piece) => STONE_PATH.test(piece ?? "")).length;

  it("are dirt in every outdoor Area, with no stone path piece", () => {
    const outdoor = Object.values(shippedWorld().areas).filter(
      (area) => area.outdoors,
    );
    expect(outdoor.length).toBe(5);
    for (const area of outdoor) {
      expect(pathsIn(area), area.name).toBe(0);
      expect(
        area.floorPieces.filter((piece) => piece === "halloween/floor_dirt")
          .length,
        area.name,
      ).toBeGreaterThan(0);
    }
  });

  it("never draw an outdoor floor with a piece that has the dusk look", () => {
    const outdoor = Object.values(shippedWorld().areas).filter(
      (area) => area.outdoors,
    );
    for (const area of outdoor) {
      for (const piece of new Set(area.floorPieces)) {
        if (piece === null || piece === "water") continue;
        expect(outdoorLookOf(piece), `${area.name}: ${piece}`).not.toBe(
          LOOKS.dusk,
        );
      }
    }
  });

  it("run as dirt through the Soggy Bog's mud", () => {
    const bog = shippedWorld().areas["soggy-bog"];
    const count = (piece: string) =>
      bog.floorPieces.filter((p) => p === piece).length;
    expect(count("dungeon/floor_dirt_large")).toBeGreaterThan(0);
    expect(count("halloween/floor_dirt")).toBeGreaterThan(0);
    expect(outdoorLookOf("halloween/floor_dirt")).toBe(LOOKS.daylightDirt);
    expect(outdoorLookOf("dungeon/floor_dirt_large")).toBe(LOOKS.mud);
  });

  it("stay stone paths in Wockville", () => {
    expect(pathsIn(shippedWorld().areas.town)).toBeGreaterThan(50);
  });
});

describe("Water in the shipped Areas", () => {
  const shipped = () => shippedWorld().areas;
  const hasWater = (area: Area) => area.water.some(Boolean);

  it("lies in the Cozy Plains as one small pond, and not in the Wockyard or Wockville", () => {
    const { "cozy-plains": plains, wockyard, town } = shipped();

    const tiles = plains.water.filter(Boolean).length;
    expect(tiles).toBeGreaterThanOrEqual(6);
    expect(tiles).toBeLessThanOrEqual(16);
    expect(hasWater(wockyard)).toBe(false);
    expect(hasWater(town)).toBe(false);
  });

  it("is never walkable, though it is floor", () => {
    for (const area of Object.values(shipped())) {
      area.water.forEach((isWater, i) => {
        if (!isWater) return;
        expect(area.floor[i]).toBe(true);
        expect(area.walkable[i]).toBe(false);
      });
    }
  });

  it("leaves every Entry, Exit, spawn, Waypoint, Bone Altar, Unique Monster and NPC reachable from each Entry", () => {
    for (const area of Object.values(shipped())) {
      const wanted: Vec[] = [
        ...area.exits.map(centreOf),
        ...area.spawns.map((spawn) => spawn.pos),
        ...area.boneAltars,
        ...area.uniques.map((unique) => unique.pos),
        ...area.npcs.map((npc) => npc.pos),
        ...(area.waypoint ? [area.waypoint] : []),
        ...(area.actBoss ? [area.actBoss.pos] : []),
      ];
      for (const entry of Object.values(area.entries)) {
        expect(isWalkable(area, entry)).toBe(true);
        for (const target of wanted) {
          expect(canReach(area, entry, target)).toBe(true);
        }
      }
    }
  });

  it("keeps the Cozy Plains' pond clear of its Exits, Entries and spawns", () => {
    const { "cozy-plains": plains } = shipped();
    const near = (point: Vec) => {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = Math.floor(point.x) + dx;
          const y = Math.floor(point.y) + dy;
          if (plains.water[y * plains.width + x]) return true;
        }
      }
      return false;
    };

    for (const entry of Object.values(plains.entries)) {
      expect(near(entry)).toBe(false);
    }
    for (const spawn of plains.spawns) expect(near(spawn.pos)).toBe(false);
    for (const exit of plains.exits) expect(near(centreOf(exit))).toBe(false);
  });
});

describe("the Cozy Plains' grass", () => {
  const plains = () => shippedWorld().areas["cozy-plains"];
  const isCity = (piece: string) => /^city\/(tree|bush)/.test(piece);

  it("is mostly grass, with dirt paths among it", () => {
    const { floorPieces, floor, water } = plains();
    const land = floorPieces.filter((_, i) => floor[i] && !water[i]);

    const grass = land.filter((piece) => piece === "city/park_base").length;
    const dirt = land.filter((piece) =>
      /^halloween\//.test(piece ?? ""),
    ).length;
    expect(grass / land.length).toBeGreaterThan(0.7);
    expect(dirt).toBeGreaterThan(40);
    expect(grass + dirt).toBe(land.length);
  });

  it("stands green trees and bushes, and no dead trees or graves", () => {
    const pieces = plains().props.map((prop) => prop.piece);

    expect(
      pieces.filter((piece) => /^city\/tree/.test(piece)).length,
    ).toBeGreaterThan(30);
    expect(
      pieces.filter((piece) => /^city\/bush/.test(piece)).length,
    ).toBeGreaterThan(10);
    expect(pieces.some((piece) => /tree_dead|grave/.test(piece))).toBe(false);
  });

  it("blocks the way exactly where a tree or a bush stands", () => {
    const area = plains();
    const standing = area.props.filter((prop) => isCity(prop.piece));

    expect(standing.length).toBeGreaterThan(0);
    for (const prop of standing) {
      expect(prop.blocks).toBe(true);
      expect(area.walkable[prop.y * area.width + prop.x]).toBe(false);
    }
    const taken = new Set(
      [...area.props, ...area.walls].map((p) => p.y * area.width + p.x),
    );
    // Cells of grass with nothing on them are open.
    area.floorPieces.forEach((piece, i) => {
      if (piece === "city/park_base" && !taken.has(i)) {
        expect(area.walkable[i]).toBe(true);
      }
    });
  });

  it("keeps its Exits, Entries and spawns off the trees and bushes", () => {
    const area = plains();
    const trees = new Set(
      area.props
        .filter((prop) => isCity(prop.piece))
        .map((prop) => `${prop.x},${prop.y}`),
    );
    const points = [
      ...Object.values(area.entries),
      ...area.spawns.map((spawn) => spawn.pos),
      ...area.exits.map(centreOf),
    ];
    for (const point of points) {
      expect(trees.has(`${Math.floor(point.x)},${Math.floor(point.y)}`)).toBe(
        false,
      );
    }
  });
});

describe("the Old Mill's grass and millpond", () => {
  const mill = () => shippedWorld().areas["old-mill"];
  const MILL_BUILDINGS = /^hexagon\/building_/;
  /** How many tiles from a millpond tile a building still stands beside it. */
  const BESIDE_THE_MILLPOND = 3;
  const pondTilesOf = (area: Area): Vec[] =>
    area.water.flatMap((isWater, i) =>
      isWater ? [{ x: i % area.width, y: Math.floor(i / area.width) }] : [],
    );

  it("is mostly grass, with dirt around the mill", () => {
    const area = mill();
    const land = area.floorPieces.filter(
      (_, i) => area.floor[i] && !area.water[i],
    );
    const grass = land.filter((piece) => piece === "city/park_base").length;
    expect(grass / land.length).toBeGreaterThan(0.7);

    const dirtAt = (x: number, y: number) =>
      /^halloween\//.test(area.floorPieces[y * area.width + x] ?? "");
    for (const prop of area.props.filter((p) => MILL_BUILDINGS.test(p.piece))) {
      expect(dirtAt(prop.x, prop.y + 1) || dirtAt(prop.x + 1, prop.y)).toBe(
        true,
      );
    }
  });

  it("stands green trees and bushes, and no dead trees or graves", () => {
    const pieces = mill().props.map((prop) => prop.piece);
    expect(pieces.filter((p) => /^city\/tree/.test(p)).length).toBeGreaterThan(
      30,
    );
    expect(pieces.filter((p) => /^city\/bush/.test(p)).length).toBeGreaterThan(
      5,
    );
    expect(pieces.some((p) => /tree_dead|grave/.test(p))).toBe(false);
  });

  it("has the watermill beside its millpond, blocking its tile, and no blacksmith", () => {
    const area = mill();
    expect(area.props.some((p) => /blacksmith/.test(p.piece))).toBe(false);
    const watermills = area.props.filter(
      (p) => p.piece === "hexagon/building_watermill_red",
    );
    expect(watermills).toHaveLength(1);
    const [watermill] = watermills;
    const besidePond = pondTilesOf(area).some(
      (tile) =>
        Math.abs(watermill.x - tile.x) <= BESIDE_THE_MILLPOND &&
        Math.abs(watermill.y - tile.y) <= BESIDE_THE_MILLPOND,
    );
    expect(besidePond).toBe(true);
    // A building's footprint in the sim is the tile it stands on.
    expect(watermill.blocks).toBe(true);
    expect(
      isWalkable(area, { x: watermill.x + 0.5, y: watermill.y + 0.5 }),
    ).toBe(false);
  });

  it("has a small millpond beside the mill", () => {
    const area = mill();
    const pond: Vec[] = [];
    area.water.forEach((isWater, i) => {
      if (isWater)
        pond.push({ x: i % area.width, y: Math.floor(i / area.width) });
    });
    expect(pond.length).toBeGreaterThanOrEqual(6);
    expect(pond.length).toBeLessThanOrEqual(16);

    const buildings = area.props.filter((p) => MILL_BUILDINGS.test(p.piece));
    const beside = pond.some((tile) =>
      buildings.some(
        (b) =>
          Math.abs(b.x - tile.x) <= BESIDE_THE_MILLPOND &&
          Math.abs(b.y - tile.y) <= BESIDE_THE_MILLPOND,
      ),
    );
    expect(beside).toBe(true);
  });

  it("keeps the millpond clear of its Exits, Entries, spawns and Wanderer", () => {
    const area = mill();
    const near = (point: Vec) => {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = Math.floor(point.x) + dx;
          const y = Math.floor(point.y) + dy;
          if (area.water[y * area.width + x]) return true;
        }
      }
      return false;
    };
    const points = [
      ...Object.values(area.entries),
      ...area.spawns.map((spawn) => spawn.pos),
      ...area.exits.map(centreOf),
      ...area.npcs.map((npc) => npc.pos),
    ];
    expect(area.npcs.length).toBeGreaterThan(0);
    for (const point of points) expect(near(point)).toBe(false);
  });

  it("lets every Entry reach every Exit, spawn and the Wanderer", () => {
    const area = mill();
    const wanted = [
      ...area.exits.map(centreOf),
      ...area.spawns.map((spawn) => spawn.pos),
      ...area.npcs.map((npc) => npc.pos),
    ];
    for (const entry of Object.values(area.entries)) {
      for (const target of wanted)
        expect(canReach(area, entry, target)).toBe(true);
    }
  });
});

describe("the KayKit tileset", () => {
  type Tile = {
    id: number;
    image: string;
    properties: { name: string; value: unknown }[];
  };
  const tiles = (tilesets.kaykit as { tiles: Tile[] }).tiles;
  const property = (tile: Tile, name: string) =>
    tile.properties.find((p) => p.name === name)?.value;

  it("has `piece`, `blocks` and `kind` on every tile", () => {
    expect(tiles.length).toBeGreaterThan(20);
    for (const tile of tiles) {
      expect(typeof property(tile, "piece")).toBe("string");
      expect(typeof property(tile, "blocks")).toBe("boolean");
      expect(["floor", "wall", "prop", "water"]).toContain(
        property(tile, "kind"),
      );
    }
  });

  it("has a thumbnail and an imported model for every tile, but for Water, which is drawn in code", () => {
    for (const tile of tiles) {
      expect(existsSync(`content/tilesets/${tile.image}`)).toBe(true);
      if (property(tile, "kind") === "water") continue;
      expect(
        existsSync(`public/assets/models/${property(tile, "piece")}.glb`),
      ).toBe(true);
    }
  });

  it("has a Water tile that does not block, as walking is decided by the Area", () => {
    const water = tiles.filter((tile) => property(tile, "kind") === "water");
    expect(water).toHaveLength(1);
    expect(property(water[0], "blocks")).toBe(false);
  });

  it("never lets a floor block", () => {
    for (const tile of tiles) {
      if (property(tile, "kind") === "floor") {
        expect(property(tile, "blocks")).toBe(false);
      }
    }
  });
});

describe("Town", () => {
  it("has no NPC standing on a Prop", () => {
    const town = shippedWorld().areas.town;
    const standingOnProp = town.npcs
      .filter((npc) =>
        town.props.some(
          (prop) =>
            prop.x === Math.floor(npc.pos.x) &&
            prop.y === Math.floor(npc.pos.y),
        ),
      )
      .map((npc) => npc.name);
    expect(standingOnProp).toEqual([]);
  });
});

describe("the shipped Waypoints", () => {
  it("stand in Wockville and every Main Path Area, and nowhere else", () => {
    const withWaypoint = Object.values(shippedWorld().areas)
      .filter((area) => area.waypoint)
      .map((area) => area.name);
    expect(withWaypoint.sort()).toEqual([
      "catacombs",
      "cozy-plains",
      "crypt",
      "ossuary",
      "soggy-bog",
      "town",
      "wockyard",
    ]);
  });

  it("list Act 1's in Main Path order, only Wockville's touched at first", () => {
    const world = shippedWorld();
    expect(waypointList(world)).toEqual([
      { area: "town", touched: true },
      { area: "cozy-plains", touched: false },
      { area: "soggy-bog", touched: false },
      { area: "wockyard", touched: false },
      { area: "catacombs", touched: false },
      { area: "crypt", touched: false },
      { area: "ossuary", touched: false },
    ]);
  });

  it("take the Hero from Wockville to the Soggy Bog once touched there", () => {
    const world = shippedWorld();
    world.hero.progress.touchedWaypoints.push("soggy-bog");
    world.hero.pos = { ...(world.areas.town.waypoint as Vec) };
    for (let i = 0; i < 100; i++) {
      const orders: Order[] =
        i === 0 ? [{ type: "TravelToWaypoint", area: "soggy-bog" }] : [];
      step(world, orders);
    }
    expect(world.areaName).toBe("soggy-bog");
    expect(waypointUnderHero(world)).toBeNull();
  });
});

describe('the shipped "Lost Wanderer" Quest', () => {
  const withWanderer = (state: "notGiven" | "ready" | "done") => ({
    ...FRESH_PROGRESS,
    quests: {
      ...FRESH_PROGRESS.quests,
      "lost-wanderer": { state, count: 0 },
    },
  });
  const inOldMill = (state: "notGiven" | "ready" | "done" = "notGiven") =>
    createWorld({
      areas,
      tilesets,
      seed: 1,
      start: { area: "old-mill", entry: "start" },
      progress: withWanderer(state),
    });

  it("leaves the Wanderer out of Wockville until rescued", () => {
    const names = npcsIn(shippedWorld()).map(({ name }) => name);

    expect(names.sort()).toEqual(["Elder", "Smith", "Trader"]);
  });

  it("flags the Trader, and only the Trader, as the Vendor", () => {
    const vendors = shippedWorld()
      .areas.town.npcs.filter((npc) => npc.vendor)
      .map(({ name }) => name);

    expect(vendors).toEqual(["Trader"]);
  });

  it("stands the Wanderer in the Old Mill, on open ground among its Monsters", () => {
    const world = inOldMill();
    const [wanderer] = npcsIn(world);

    expect(wanderer.name).toBe("Wanderer");
    expect(
      findPath(world.areas["old-mill"], world.hero.pos, wanderer.pos, 0.3)
        .length,
    ).toBeGreaterThan(0);
    const nearest = Math.min(
      ...world.areas["old-mill"].spawns.map((spawn) =>
        Math.hypot(spawn.pos.x - wanderer.pos.x, spawn.pos.y - wanderer.pos.y),
      ),
    );
    expect(nearest).toBeLessThanOrEqual(6);
  });

  it("sends the Wanderer home when talked to: gone from the Old Mill, Quest Ready", () => {
    const world = inOldMill();
    world.monsters = [];
    const [wanderer] = npcsIn(world);

    let ready = false;
    for (let i = 0; i < 1200; i++) {
      const orders: Order[] =
        i === 0 ? [{ type: "Talk", npc: wanderer.id }] : [];
      for (const event of step(world, orders)) {
        if (event.type === "QuestReady") ready = true;
      }
    }

    expect(ready).toBe(true);
    expect(npcsIn(world)).toEqual([]);
  });

  it("puts the Wanderer in Wockville and not the Old Mill once rescued", () => {
    for (const state of ["ready", "done"] as const) {
      expect(npcsIn(inOldMill(state))).toEqual([]);
      const home = createWorld({
        areas,
        tilesets,
        seed: 1,
        progress: withWanderer(state),
      });
      expect(npcsIn(home).map(({ name }) => name)).toContain("Wanderer");
    }
  });
});

describe('the shipped "Bog Off" Quest', () => {
  const bogOffIs = (state: "notGiven" | "ready" | "done", count = 0) => ({
    ...FRESH_PROGRESS,
    quests: { ...FRESH_PROGRESS.quests, "bog-off": { state, count } },
  });
  const inBog = (progress = FRESH_PROGRESS) =>
    createWorld({
      areas,
      tilesets,
      seed: 1,
      start: { area: "soggy-bog", entry: "start" },
      progress,
    });

  it("has exactly 3 Bone Altars in the Soggy Bog, all reachable, and none elsewhere", () => {
    const world = shippedWorld();
    const counts = Object.values(world.areas)
      .filter((area) => area.boneAltars.length > 0)
      .map((area) => [area.name, area.boneAltars.length]);

    expect(counts).toEqual([["soggy-bog", 3]]);
    expect(inBog().boneAltars).toHaveLength(3);
  });

  it("is Ready once the Hero has destroyed all 3, even Not given", () => {
    const world = inBog();
    world.hero.life = 1_000_000;
    let ready = false;
    while (world.boneAltars.length > 0) {
      const [altar] = world.boneAltars;
      world.monsters = [];
      world.hero.pos = { x: altar.pos.x - 1.2, y: altar.pos.y };
      world.hero.prevPos = { ...world.hero.pos };
      for (let i = 0; i < 2400 && world.boneAltars.includes(altar); i++) {
        const orders: Order[] =
          i % 300 === 0 ? [{ type: "Attack", monster: altar.id }] : [];
        for (const event of step(world, orders)) {
          if (event.type === "QuestReady") ready = true;
        }
        world.hero.life = 1_000_000;
      }
      expect(world.boneAltars).not.toContain(altar);
    }

    expect(ready).toBe(true);
    expect(questOf(world, "bog-off")).toEqual({ state: "ready", count: 3 });
  });

  it("pays 1 Skill Point once, handed in to the Trader in Wockville", () => {
    const world = createWorld({
      areas,
      tilesets,
      seed: 1,
      progress: bogOffIs("ready", 3),
    });
    const trader = npcsIn(world).find(({ name }) => name === "Trader");
    if (!trader) throw new Error("no Trader");
    world.hero.pos = { x: trader.pos.x - 1, y: trader.pos.y };
    world.hero.prevPos = { ...world.hero.pos };
    const before = world.hero.progress.skillPoints;

    step(world, [{ type: "HandInQuest", quest: "bog-off" }]);
    step(world, [{ type: "HandInQuest", quest: "bog-off" }]);

    expect(questOf(world, "bog-off").state).toBe("done");
    expect(world.hero.progress.skillPoints).toBe(before + 1);
  });

  it("puts the Bone Altars away for good once Done, through the Save too", () => {
    // The reward is already in the Hero points, as the Save checks.
    const done = { ...bogOffIs("done", 3), skillPoints: 1 };
    const saved = parseSave(
      encodeSave(
        saveOf(createWorld({ areas, tilesets, seed: 1, progress: done })),
      ),
    );

    expect(saved).not.toBeNull();
    expect(inBog(saved?.progress).boneAltars).toHaveLength(0);
  });

  it("brings the Bone Altars back in a new Session until it is Done", () => {
    for (const state of ["notGiven", "ready"] as const) {
      const saved = parseSave(
        encodeSave(
          saveOf(
            createWorld({
              areas,
              tilesets,
              seed: 1,
              progress: bogOffIs(state, state === "ready" ? 3 : 1),
            }),
          ),
        ),
      );
      expect(inBog(saved?.progress).boneAltars).toHaveLength(3);
    }
  });
});

/**
 * Ticks (80 s) the Spa Day tests give a Hero to kill Bruckle: past the 45–60 s
 * his fight is tuned to, close to the 6000 ticks that fell the Ossuary's boss.
 */
const UNIQUE_KILL_TICKS = 80 * STEPS_PER_SECOND;

/** The reference Hero for Bruckle's fight: one just arrived at the Spa. */
const SPA_ARRIVAL_PROGRESS = {
  ...FRESH_PROGRESS,
  level: 3,
  experience: levelExperience(3),
};

describe('the shipped "Spa Day" Quest', () => {
  const inSpa = (progress = FRESH_PROGRESS) =>
    createWorld({
      areas,
      tilesets,
      seed: 1,
      start: { area: "spa", entry: "start" },
      progress,
    });

  /** Bruckle's fight alone with the Hero, as `fightUniqueAlone` runs it. */
  function fightBruckleAlone(world: World) {
    const bruckle = world.monsters.find((one) => one.unique === "Bruckle");
    expect(bruckle?.type).toBe("wockbrute");
    return fightUniqueAlone(world, "Bruckle", UNIQUE_KILL_TICKS);
  }

  it("takes a Hero just arrived at the Spa 45–60 s of steady melee to kill Bruckle", () => {
    const { ticks } = fightBruckleAlone(inSpa(SPA_ARRIVAL_PROGRESS));

    expect(ticks / STEPS_PER_SECOND).toBeGreaterThanOrEqual(45);
    expect(ticks / STEPS_PER_SECOND).toBeLessThanOrEqual(60);
  });

  /** Puts the Hero beside the NPC called `name`, in reach to talk. */
  function beside(world: World, name: string) {
    const npc = npcsIn(world).find((one) => one.name === name);
    if (!npc) throw new Error(`no ${name}`);
    world.hero.pos = { x: npc.pos.x - 1, y: npc.pos.y };
    world.hero.prevPos = { ...world.hero.pos };
  }

  it("has exactly one Unique Monster in the Spa, and none elsewhere", () => {
    const uniques = Object.values(shippedWorld().areas)
      .filter((area) => area.uniques.length > 0)
      .map((area) => [area.name, area.uniques.length]);

    expect(uniques).toEqual([["spa", 1]]);
    expect(inSpa().monsters.filter((monster) => monster.unique)).toHaveLength(
      1,
    );
  });

  it("is Ready once the Hero kills Bruckle, then Done at the Smith", () => {
    const world = inSpa();
    const { events } = fightBruckleAlone(world);

    expect(events.some((event) => event.type === "QuestReady")).toBe(true);
    expect(questOf(world, "spa-day").state).toBe("ready");

    const town = createWorld({
      areas,
      tilesets,
      seed: 1,
      progress: world.hero.progress,
    });
    beside(town, "Smith");
    step(town, [{ type: "HandInQuest", quest: "spa-day" }]);
    step(town, [{ type: "HandInQuest", quest: "spa-day" }]);

    expect(questOf(town, "spa-day").state).toBe("done");
  });

  it("brings the Unique Monster back in a new Session, Done or not", () => {
    for (const state of ["notGiven", "done"] as const) {
      const progress = {
        ...FRESH_PROGRESS,
        quests: {
          ...FRESH_PROGRESS.quests,
          "spa-day": { state, count: state === "done" ? 1 : 0 },
        },
      };

      expect(
        inSpa(progress).monsters.some((monster) => monster.unique !== null),
      ).toBe(true);
    }
  });
});

describe("the shipped Act 1", () => {
  it("is whole: one Act Boss spawn, a Waypoint in Wockville, every Quest's objects", () => {
    const { areas: shipped } = shippedWorld();

    expect(() => validateActs(shipped)).not.toThrow();
    expect(() => validateQuests(shipped)).not.toThrow();
  });
});

describe("loading the shipped content into a World", () => {
  it("checks the Act and the Quests are whole", () => {
    expect(() => createShippedWorld({ seed: 1 })).not.toThrow();

    const bossless = JSON.parse(JSON.stringify(areas.ossuary));
    for (const layer of bossless.layers) {
      if (layer.type !== "objectgroup") continue;
      layer.objects = layer.objects.filter(
        (object: { type?: string }) => object.type !== "actBoss",
      );
    }
    expect(() =>
      createShippedWorld(
        { seed: 1 },
        { areas: { ...areas, ossuary: bossless }, tilesets },
      ),
    ).toThrow(/Act 1 has 0 Act Boss spawns/);
  });
});

/**
 * How far from Bruckle (tiles) a Wockwolf counts as his guard: his pack stands
 * about 2 tiles off, the Spa's other Wockwolves 15.
 */
const GUARD_RADIUS = 3;

/** Whether a Spa Spawn is Bruckle's own pack of guards. */
const isBruckleGuard = (spawn: Spawn, bruckle: Vec) =>
  spawn.monster === "wockwolf" && distance(spawn.pos, bruckle) <= GUARD_RADIUS;

/**
 * How far from Bruckle's spawn (tiles) the Hero may fight him without another
 * Spa pack noticing.
 */
const BRUCKLE_FIGHT_RADIUS = 5;

/** The Spa's row that the fence south of Bruckle's yard runs along. */
const FENCE_ROW = 9;

/**
 * The tiles of a walk from `from` to `to` over walkable tiles, joined in 8
 * directions without cutting a blocked corner, that never steps on a tile
 * whose centre lies within notice range of one of `packs`; null if none.
 */
function unnoticedPath(
  area: Area,
  from: Vec,
  to: Vec,
  packs: readonly Spawn[],
): Vec[] | null {
  const centre = (x: number, y: number) => ({ x: x + 0.5, y: y + 0.5 });
  const open = (x: number, y: number) =>
    isWalkable(area, centre(x, y)) &&
    packs.every(
      (pack) =>
        distance(centre(x, y), pack.pos) >
        monsterTuning[pack.monster].aggroRadius,
    );
  const start = { x: Math.floor(from.x), y: Math.floor(from.y) };
  const goal = { x: Math.floor(to.x), y: Math.floor(to.y) };
  const key = (x: number, y: number) => y * area.width + x;
  const cameFrom = new Map<number, number | null>([
    [key(start.x, start.y), null],
  ]);
  const queue = [start];
  while (queue.length > 0) {
    const at = queue.shift() as Vec;
    if (at.x === goal.x && at.y === goal.y) {
      const tiles: Vec[] = [];
      for (
        let k: number | null | undefined = key(at.x, at.y);
        k != null;
        k = cameFrom.get(k)
      ) {
        tiles.unshift({ x: k % area.width, y: Math.floor(k / area.width) });
      }
      return tiles;
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = at.x + dx;
        const y = at.y + dy;
        if ((dx === 0 && dy === 0) || cameFrom.has(key(x, y))) continue;
        if (!open(x, y)) continue;
        if (
          dx !== 0 &&
          dy !== 0 &&
          !(open(at.x + dx, at.y) && open(at.x, at.y + dy))
        )
          continue;
        cameFrom.set(key(x, y), key(at.x, at.y));
        queue.push({ x, y });
      }
    }
  }
  return null;
}

describe("the shipped Act 1's Main Path", () => {
  it("lists the Waypoints from Wockville out to the Ossuary", () => {
    expect(waypointList(shippedWorld()).map((w) => w.area)).toEqual([
      "town",
      "cozy-plains",
      "soggy-bog",
      "wockyard",
      "catacombs",
      "crypt",
      "ossuary",
    ]);
  });

  it("names the Spa's Unique Monster Bruckle, a Wockbrute", () => {
    const spa = shippedWorld().areas.spa;
    expect(spa.uniques.map((unique) => [unique.name, unique.monster])).toEqual([
      ["Bruckle", "wockbrute"],
    ]);
  });

  it("stands Bruckle at the far end of the Spa from the Cozy Plains entry", () => {
    const spa = shippedWorld().areas.spa;
    const bruckle = spa.uniques[0].pos;
    const entry = spa.entries["from-cozy-plains"];
    const deepestSpawn = Math.max(
      ...spa.spawns.map((s) => Math.abs(s.pos.y - entry.y)),
    );

    // The entry is at the Spa's south edge. He stands straight across from it,
    // and no Spawn lies further along that axis.
    expect(bruckle.x).toBe(entry.x);
    expect(Math.abs(bruckle.y - entry.y)).toBeGreaterThanOrEqual(deepestSpawn);
  });

  it("stands 5 ordinary Wockwolves around Bruckle, beside the Spa's other Monsters", () => {
    const spa = shippedWorld().areas.spa;
    const bruckle = spa.uniques[0].pos;
    const guards = spa.spawns.filter((s) => isBruckleGuard(s, bruckle));

    expect(guards.map((s) => s.count)).toEqual([5]);
    expect(new Set(spa.spawns.map((s) => s.monster))).toEqual(
      new Set(["skeleton", "zombie", "wockwolf", "bog_spitter"]),
    );
  });

  it("stands every other Spa pack too far off to notice a Hero fighting within 5 tiles of Bruckle", () => {
    const spa = shippedWorld().areas.spa;
    const bruckle = spa.uniques[0].pos;
    const others = spa.spawns.filter((s) => !isBruckleGuard(s, bruckle));

    expect(others.length).toBeGreaterThan(0);
    for (const spawn of others) {
      expect(
        distance(spawn.pos, bruckle),
        `${spawn.count} ${spawn.monster} at (${spawn.pos.x}, ${spawn.pos.y})`,
      ).toBeGreaterThan(
        BRUCKLE_FIGHT_RADIUS + monsterTuning[spawn.monster].aggroRadius,
      );
    }
  });

  it("leads a path from the Cozy Plains Entry through the fence's south gap to Bruckle, out of every other pack's notice", () => {
    const spa = shippedWorld().areas.spa;
    const bruckle = spa.uniques[0].pos;
    const others = spa.spawns.filter((s) => !isBruckleGuard(s, bruckle));
    const path = unnoticedPath(
      spa,
      spa.entries["from-cozy-plains"],
      bruckle,
      others,
    );
    if (!path) throw new Error("no unnoticed path to Bruckle");

    // It crosses the fence's row straight south of him, not by the side routes.
    const crossings = path.filter((tile) => tile.y === FENCE_ROW);
    expect(crossings.length).toBeGreaterThan(0);
    for (const tile of crossings) {
      expect(Math.abs(tile.x + 0.5 - bruckle.x)).toBeLessThanOrEqual(2);
    }
  });

  it("spawns Bruckle as a Unique Wockbrute with exactly 5 ordinary Wockwolves around him", () => {
    const world = createWorld({
      areas,
      tilesets,
      seed: 1,
      start: { area: "spa", entry: "start" },
    });
    const bruckle = world.monsters.find((m) => m.unique === "Bruckle");
    if (!bruckle) throw new Error("no Bruckle");
    const guards = world.monsters.filter(
      (m) =>
        m.type === "wockwolf" && distance(m.pos, bruckle.pos) <= GUARD_RADIUS,
    );

    expect(bruckle.type).toBe("wockbrute");
    expect(guards).toHaveLength(5);
    expect(guards.every((m) => m.unique === null)).toBe(true);
  });

  it('names Bruckle in "Spa Day"\'s lines and next step, keeping its Done line', () => {
    const quest = questTuning["spa-day"];

    expect(quest.lines).toEqual({
      notGiven:
        "A Wockbrute calls himself Bruckle and has taken over the Spa. Mud baths, he says. Kill him, and I'll put my best work into your gear.",
      given:
        "Bruckle still lounges in the Spa. Mind his wolves, and mind that Slam.",
      ready: "Bruckle's bathed his last! Let me show you what my hands can do.",
      done: "Steel never lies. Mind your gear.",
    });
    expect(quest.nextStep).toBe("Kill Bruckle in the Spa.");
  });
});

describe("Grave Wockington's room in the shipped Ossuary", () => {
  const { ossuary } = shippedWorld().areas;
  // His room is the walkable tiles from row 47 down; the 3-wide corridor
  // north of it (rows 39-46) runs up to the room before it.
  const ROOM_TOP = 47;
  const CORRIDOR = { x: [14, 17], y: [39, 47] };
  const MIDDLE_ROOM = { x: [6, 34], y: [25, 39] };
  const inside = (box: { x: number[]; y: number[] }, pos: Vec) =>
    pos.x >= box.x[0] &&
    pos.x < box.x[1] &&
    pos.y >= box.y[0] &&
    pos.y < box.y[1];
  const inRoom = (pos: Vec) => pos.y >= ROOM_TOP;
  const boss = ossuary.actBoss;

  it("holds only him when the Hero walks in", () => {
    const world = createWorld({
      areas,
      tilesets,
      seed: 1,
      start: { area: "ossuary", entry: "start" },
    });
    expect(boss).not.toBeNull();
    expect(inRoom(boss?.pos ?? { x: 0, y: 0 })).toBe(true);
    expect(ossuary.spawns.filter((spawn) => inRoom(spawn.pos))).toEqual([]);
    expect(
      world.monsters.filter((m) => inRoom(m.pos)).map((m) => m.type),
    ).toEqual(["grave_wockington"]);
  });

  it("moves the room's former Monsters into the corridor north of it and the room before it", () => {
    const counts = (monster: MonsterType) =>
      ossuary.spawns
        .filter(
          (s) =>
            s.monster === monster &&
            (inside(CORRIDOR, s.pos) || inside(MIDDLE_ROOM, s.pos)),
        )
        .reduce((total, s) => total + s.count, 0);
    expect(
      ossuary.spawns.filter((s) => inside(CORRIDOR, s.pos)).length,
    ).toBeGreaterThan(0);
    // Twelve Monsters moved: more than the three middle-room packs hold.
    expect(counts("skeleton")).toBeGreaterThanOrEqual(5 + 7);
    expect(counts("zombie")).toBeGreaterThanOrEqual(2 + 2);
    expect(counts("skeleton_archer")).toBeGreaterThanOrEqual(2 + 3);
  });

  it("gives him a Leash from his spawn that reaches every walkable tile of his room and stops short of the corridor's far end", () => {
    const home = boss?.pos ?? { x: 0, y: 0 };
    const leash = monsterTuning.grave_wockington.leash;
    const gap = (to: Vec) => Math.hypot(to.x - home.x, to.y - home.y);
    let tiles = 0;
    for (let y = ROOM_TOP; y < ossuary.height; y++) {
      for (let x = 0; x < ossuary.width; x++) {
        if (!isWalkable(ossuary, { x: x + 0.5, y: y + 0.5 })) continue;
        tiles++;
        expect(gap({ x: x + 0.5, y: y + 0.5 }), `tile ${x},${y}`).toBeLessThan(
          leash,
        );
      }
    }
    expect(tiles).toBeGreaterThan(100);
    for (let x = CORRIDOR.x[0]; x < CORRIDOR.x[1]; x++) {
      expect(gap({ x: x + 0.5, y: CORRIDOR.y[0] + 0.5 })).toBeGreaterThan(
        leash,
      );
    }
  });

  it("keeps the Ossuary's Waypoint at the Area's start", () => {
    const start = ossuary.entries.start;
    const waypoint = ossuary.waypoint;
    expect(waypoint).not.toBeNull();
    expect(
      Math.hypot((waypoint?.x ?? 0) - start.x, (waypoint?.y ?? 0) - start.y),
    ).toBeLessThan(5);
  });
});

describe("Grave Wockington in the shipped Ossuary", () => {
  const inOssuary = (state: "notGiven" | "given" | "ready" | "done") =>
    createWorld({
      areas,
      tilesets,
      seed: 1,
      start: { area: "ossuary", entry: "start" },
      progress: {
        ...FRESH_PROGRESS,
        quests: { ...FRESH_PROGRESS.quests, "act-boss": { state, count: 0 } },
      },
    });

  /** Kills Grave Wockington, alone with the Hero; the events. */
  function killBoss(world: World): SimEvent[] {
    const boss = world.monsters.find((m) => m.type === "grave_wockington");
    if (!boss) throw new Error("no Grave Wockington");
    world.monsters = [boss];
    boss.life = 1;
    world.hero.pos = { x: boss.pos.x - 1.2, y: boss.pos.y };
    world.hero.prevPos = { ...world.hero.pos };
    const events: SimEvent[] = [];
    for (let i = 0; i < 6000 && world.monsters.includes(boss); i++) {
      const orders: Order[] =
        i % 120 === 0 ? [{ type: "Attack", monster: boss.id }] : [];
      events.push(...step(world, orders));
      world.hero.life = 1_000_000;
    }
    return events;
  }

  it("is the one Unique Monster waiting at the end of the Main Path, alone in his Act", () => {
    const world = inOssuary("notGiven");
    const bosses = world.monsters.filter(
      (m) => m.unique === "Grave Wockington",
    );

    expect(bosses).toHaveLength(1);
    expect(bosses[0].type).toBe("grave_wockington");
    expect(bosses[0].monsterLevel).toBe(11);
    expect(
      Object.values(world.areas)
        .filter((area) => area.actBoss)
        .map((area) => area.name),
    ).toEqual(["ossuary"]);
  });

  it("completes Act I on his death, Quest given or not, and the Elder takes it back", () => {
    for (const state of ["notGiven", "given"] as const) {
      const world = inOssuary(state);

      const events = killBoss(world);

      expect(events).toContainEqual({ type: "ActCompleted", act: 1 });
      expect(questOf(world, "act-boss").state).toBe("ready");

      const town = createWorld({
        areas,
        tilesets,
        seed: 1,
        progress: world.hero.progress,
      });
      const elder = npcsIn(town).find((npc) => npc.name === "Elder");
      if (!elder) throw new Error("no Elder");
      town.hero.pos = { x: elder.pos.x - 1, y: elder.pos.y };
      town.hero.prevPos = { ...town.hero.pos };
      step(town, [{ type: "HandInQuest", quest: "act-boss" }]);
      step(town, [{ type: "HandInQuest", quest: "act-boss" }]);

      expect(questOf(town, "act-boss").state).toBe("done");
      expect(town.areaName).toBe("town");
    }
  });

  it("is back in a new Session, and shows no banner once the Quest is Done", () => {
    const world = inOssuary("done");

    const events = killBoss(world);

    expect(events.some((e) => e.type === "MonsterDied")).toBe(true);
    expect(events.some((e) => e.type === "ActCompleted")).toBe(false);
    expect(
      inOssuary("done").monsters.some((m) => m.unique === "Grave Wockington"),
    ).toBe(true);
  });
});

describe("the Spa's hot springs", () => {
  const spa = () => shippedWorld().areas.spa;

  it("are the Spa's alone: no other shipped Area marks its Water as hot springs", () => {
    const hot = Object.values(shippedWorld().areas)
      .filter((area) => area.hotSprings)
      .map((area) => area.name);

    expect(hot).toEqual(["spa"]);
  });

  it("are two or three pools in place of the wells", () => {
    const area = spa();
    const pools = pondsOf(area);

    expect(pools.length).toBeGreaterThanOrEqual(2);
    expect(pools.length).toBeLessThanOrEqual(3);
    for (const pool of pools) {
      expect(pool.tiles.length).toBeGreaterThanOrEqual(6);
    }
    expect(area.props.some((prop) => /well/.test(prop.piece))).toBe(false);
  });

  it("is mostly grass, with dirt around the bathhouse", () => {
    const { floorPieces, floor, water, props, width } = spa();
    const land = floorPieces.filter((_, i) => floor[i] && !water[i]);
    const grass = land.filter((piece) => piece === "city/park_base").length;
    expect(grass / land.length).toBeGreaterThan(0.6);

    const houses = props.filter((prop) => /building_/.test(prop.piece));
    expect(houses.length).toBeGreaterThan(0);
    for (const house of houses) {
      expect(floorPieces[house.y * width + house.x]).toMatch(/^halloween\//);
    }
  });

  it("stands green trees, and no dead trees or graves", () => {
    const pieces = spa().props.map((prop) => prop.piece);

    expect(
      pieces.filter((piece) => /^city\/tree/.test(piece)).length,
    ).toBeGreaterThan(30);
    expect(pieces.some((piece) => /tree_dead|grave/.test(piece))).toBe(false);
  });

  it("has a `pools` Entry beside its pools, which no Exit leads to", () => {
    const world = shippedWorld();
    const area = world.areas.spa;
    const pools = area.entries.pools;

    expect(pools).toBeDefined();
    const nearest = Math.min(
      ...pondsOf(area)
        .flatMap((pool) => pool.tiles)
        .map((tile) => distance({ x: tile.x + 0.5, y: tile.y + 0.5 }, pools)),
    );
    expect(nearest).toBeLessThanOrEqual(3);
    expect(canReach(area, area.entries.start, pools)).toBe(true);
    const leadingHere = Object.values(world.areas).flatMap((other) =>
      other.exits.filter(
        (exit) => exit.area === "spa" && exit.entry === "pools",
      ),
    );
    expect(leadingHere).toEqual([]);
  });

  it("keeps its Entries, Exits, spawns and Unique Monster reachable, and dry", () => {
    const area = spa();
    const wanted = [
      ...area.exits.map(centreOf),
      ...area.spawns.map((spawn) => spawn.pos),
      ...area.uniques.map((unique) => unique.pos),
    ];
    expect(area.uniques).toHaveLength(1);
    for (const entry of Object.values(area.entries)) {
      for (const target of wanted) {
        expect(canReach(area, entry, target)).toBe(true);
      }
    }
    for (const point of [...Object.values(area.entries), ...wanted]) {
      const cell = Math.floor(point.y) * area.width + Math.floor(point.x);
      expect(area.water[cell]).toBe(false);
    }
  });
});

describe("the Wockyard's sparse grass", () => {
  const wockyard = () => shippedWorld().areas.wockyard;

  it("is mostly dirt, with sparse patches of grass", () => {
    const { floorPieces, floor } = wockyard();
    const land = floorPieces.filter((_, i) => floor[i]);

    const grass = land.filter((piece) => piece === "city/park_base").length;
    const dirt = land.filter((piece) =>
      /^halloween\//.test(piece ?? ""),
    ).length;
    expect(grass / land.length).toBeGreaterThan(0.05);
    expect(grass / land.length).toBeLessThan(0.25);
    expect(grass + dirt).toBe(land.length);
  });

  it("stands only dead trees: no green trees or bushes", () => {
    const pieces = wockyard().props.map((prop) => prop.piece);

    expect(pieces.some((piece) => /tree_dead/.test(piece))).toBe(true);
    expect(pieces.some((piece) => /^city\//.test(piece))).toBe(false);
  });

  it("has no Water", () => {
    expect(wockyard().water.some(Boolean)).toBe(false);
  });
});

describe("the Soggy Bog's ponds and mud", () => {
  const bog = () => shippedWorld().areas["soggy-bog"];
  const mud = "dungeon/floor_dirt_large";

  it("is mostly mud, with grass patches among it", () => {
    const { floorPieces, floor, water } = bog();
    const land = floorPieces.filter((_, i) => floor[i] && !water[i]);
    const count = (piece: string) => land.filter((p) => p === piece).length;

    expect(count(mud) / land.length).toBeGreaterThan(0.5);
    expect(count("city/park_base")).toBeGreaterThan(100);
  });

  it("stands dead trees and some bushes", () => {
    const pieces = bog().props.map((prop) => prop.piece);

    expect(pieces.filter((p) => /tree_dead/.test(p)).length).toBeGreaterThan(
      50,
    );
    expect(pieces.filter((p) => /^city\/bush/.test(p)).length).toBeGreaterThan(
      20,
    );
    expect(pieces.some((p) => /^city\/tree/.test(p))).toBe(false);
  });

  it("has several ponds, and more Water than any other Area", () => {
    const tilesOf = (area: Area) => area.water.filter(Boolean).length;
    const areas = shippedWorld().areas;
    const { width, water } = areas["soggy-bog"];

    // Count ponds as 4-connected groups of Water tiles.
    const seen = new Set<number>();
    let ponds = 0;
    water.forEach((isWater, start) => {
      if (!isWater || seen.has(start)) return;
      ponds++;
      const queue = [start];
      seen.add(start);
      while (queue.length > 0) {
        const at = queue.pop() as number;
        for (const next of [at - 1, at + 1, at - width, at + width]) {
          if (water[next] && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
    });
    expect(ponds).toBeGreaterThanOrEqual(4);
    for (const [name, area] of Object.entries(areas)) {
      if (name !== "soggy-bog") {
        expect(tilesOf(areas["soggy-bog"])).toBeGreaterThan(tilesOf(area));
      }
    }
  });

  it("keeps its Entries, Exits, Waypoint, Bone Altars and spawns dry and reachable from every Entry", () => {
    const area = bog();
    expect(area.boneAltars).toHaveLength(3);
    expect(area.waypoint).toBeDefined();
    const wanted: Vec[] = [
      ...area.exits.map(centreOf),
      ...area.spawns.map((spawn) => spawn.pos),
      ...area.boneAltars,
      ...(area.waypoint ? [area.waypoint] : []),
    ];
    for (const point of [...wanted, ...Object.values(area.entries)]) {
      const at = Math.floor(point.y) * area.width + Math.floor(point.x);
      expect(area.water[at]).toBe(false);
    }
    for (const entry of Object.values(area.entries)) {
      for (const target of wanted) {
        expect(canReach(area, entry, target)).toBe(true);
      }
    }
  });
});

describe("the shipped Bog Spitters", () => {
  const bogSpitters = (area: Area) => sum(packsOf(area, "bog_spitter"));

  it("are the most common Monster in the Soggy Bog, and more of them than in any other Area", () => {
    const { areas } = shippedWorld();
    const bog = areas["soggy-bog"];
    const count = (monster: MonsterType) => sum(packsOf(bog, monster));

    for (const other of [
      "skeleton",
      "zombie",
      "wockwolf",
      "skeleton_archer",
    ] as const) {
      expect(count("bog_spitter")).toBeGreaterThan(count(other));
    }
    for (const [name, area] of Object.entries(areas)) {
      if (name !== "soggy-bog") {
        expect(bogSpitters(bog)).toBeGreaterThan(bogSpitters(area));
      }
    }
  });

  it("are placed in the Spa and the Old Mill, and never underground", () => {
    const { areas } = shippedWorld();

    expect(bogSpitters(areas.spa)).toBeGreaterThan(0);
    expect(bogSpitters(areas["old-mill"])).toBeGreaterThan(0);
    for (const name of ["catacombs", "crypt", "ossuary"]) {
      expect(bogSpitters(areas[name])).toBe(0);
    }
  });

  it("meet the Hero when they arrive in the Soggy Bog", () => {
    const world = worldEntering("soggy-bog", "from-cozy-plains");

    expect(
      world.monsters.filter((monster) => monster.type === "bog_spitter").length,
    ).toBe(bogSpitters(world.areas["soggy-bog"]));
  });
});

describe("the shipped Wockbrutes", () => {
  const brutes = (area: Area) => sum(packsOf(area, "wockbrute"));

  it("are the most common Monster in the Old Mill, and more of them than in any other Area", () => {
    const { areas } = shippedWorld();
    const mill = areas["old-mill"];
    const count = (monster: MonsterType) => sum(packsOf(mill, monster));

    for (const other of [
      "skeleton",
      "zombie",
      "wockwolf",
      "bog_spitter",
      "skeleton_archer",
    ] as const) {
      expect(count("wockbrute")).toBeGreaterThan(count(other));
    }
    for (const [name, area] of Object.entries(areas)) {
      if (name !== "old-mill") {
        expect(brutes(mill)).toBeGreaterThan(brutes(area));
      }
    }
  });

  it("are a few in the Soggy Bog and the odd one in the Wockyard", () => {
    const { areas } = shippedWorld();

    expect(brutes(areas["soggy-bog"])).toBeGreaterThan(0);
    expect(brutes(areas.wockyard)).toBeGreaterThan(0);
    expect(brutes(areas.wockyard)).toBeLessThan(brutes(areas["soggy-bog"]));
  });

  it("guard the Wockyard's way in", () => {
    const world = worldEntering("wockyard", "from-soggy-bog");
    const yard = world.areas.wockyard;
    const [guard] = yard.spawns.filter((s) => s.monster === "wockbrute");

    expect(
      Math.hypot(
        guard.pos.x - world.hero.pos.x,
        guard.pos.y - world.hero.pos.y,
      ),
    ).toBeLessThan(15);
  });

  it("are never in the Cozy Plains, the Town nor underground", () => {
    const { areas } = shippedWorld();

    for (const name of [
      "cozy-plains",
      "town",
      "catacombs",
      "crypt",
      "ossuary",
    ]) {
      expect(brutes(areas[name])).toBe(0);
    }
  });
});

describe("the shipped Wockwolf packs", () => {
  const wolves = (area: Area) => sum(packsOf(area, "wockwolf"));

  it("are the most common Monster in the Cozy Plains, and more of them than in any other Area", () => {
    const { areas } = shippedWorld();
    const plains = areas["cozy-plains"];
    const count = (monster: MonsterType) => sum(packsOf(plains, monster));

    expect(count("wockwolf")).toBeGreaterThan(count("skeleton"));
    expect(count("wockwolf")).toBeGreaterThan(count("zombie"));
    for (const [name, area] of Object.entries(areas)) {
      if (name !== "cozy-plains") {
        expect(wolves(plains)).toBeGreaterThan(wolves(area));
      }
    }
  });

  it("come in packs of 4 to 6", () => {
    for (const area of Object.values(shippedWorld().areas)) {
      for (const pack of packsOf(area, "wockwolf")) {
        expect(pack).toBeGreaterThanOrEqual(4);
        expect(pack).toBeLessThanOrEqual(6);
      }
    }
  });

  it("are placed in the Spa and the Soggy Bog, and never underground", () => {
    const { areas } = shippedWorld();

    expect(wolves(areas.spa)).toBeGreaterThan(0);
    expect(wolves(areas["soggy-bog"])).toBeGreaterThan(0);
    for (const name of ["catacombs", "crypt", "ossuary"]) {
      expect(wolves(areas[name])).toBe(0);
    }
  });

  it("meet the Hero when they arrive in the Cozy Plains", () => {
    const world = worldEntering("cozy-plains", "from-town");

    expect(
      world.monsters.filter((monster) => monster.type === "wockwolf").length,
    ).toBe(wolves(world.areas["cozy-plains"]));
  });
});

describe("the dev-only `fight` Entries", () => {
  /** How near a `fight` Entry stands to the nearest Monster at least, in tiles: not on top of it. */
  const FIGHT_ENTRY_MIN_DISTANCE = 3;
  /** How near it stands at most, in tiles: near enough for the pack to notice the Hero on arrival. */
  const FIGHT_ENTRY_MAX_DISTANCE = 4;

  /**
   * The Areas whose `fight` Entry stands off walkable floor, or whose nearest
   * Monster (a pack's spawn, a Unique Monster or the Act Boss) is not 3 to 4
   * tiles away, each with why.
   */
  const misplacedFightEntries = (areasByName: Record<string, Area>) =>
    Object.entries(areasByName).flatMap(([name, area]) => {
      const fight = area.entries.fight;
      if (!fight) return [];
      if (!isWalkable(area, fight)) return [`${name}: off walkable floor`];
      const monsters = [
        ...area.spawns.map((spawn) => spawn.pos),
        ...area.uniques.map((unique) => unique.pos),
        ...(area.actBoss ? [area.actBoss.pos] : []),
      ];
      const nearest = Math.min(...monsters.map((pos) => distance(pos, fight)));
      return nearest >= FIGHT_ENTRY_MIN_DISTANCE &&
        nearest <= FIGHT_ENTRY_MAX_DISTANCE
        ? []
        : [`${name}: nearest Monster ${nearest.toFixed(1)} tiles away`];
    });

  it("is in every Area with Monsters", () => {
    const without = Object.entries(shippedWorld().areas)
      .filter(
        ([, area]) =>
          area.spawns.length > 0 || area.uniques.length > 0 || area.actBoss,
      )
      .filter(([, area]) => !area.entries.fight)
      .map(([name]) => name);
    expect(without).toEqual([]);
  });

  it("stands on walkable floor, 3 to 4 tiles from the nearest Monster", () => {
    expect(misplacedFightEntries(shippedWorld().areas)).toEqual([]);
  });

  it("is reported when no Monster stands 3 to 4 tiles from it", () => {
    const { catacombs } = shippedWorld().areas;
    const far = {
      ...catacombs,
      entries: { ...catacombs.entries, fight: catacombs.entries.start },
    };
    expect(misplacedFightEntries({ catacombs: far })).toEqual([
      expect.stringMatching(/^catacombs: nearest Monster/),
    ]);
  });

  it("starts the Hero in the Spa within reach of Bruckle and his Wockwolves", () => {
    const { spa } = shippedWorld().areas;
    const fight = spa.entries.fight;
    const bruckle = spa.uniques.find((unique) => unique.name === "Bruckle");

    expect(fight).toBeDefined();
    expect(bruckle).toBeDefined();
    const away = distance(bruckle?.pos ?? { x: 0, y: 0 }, fight);
    expect(away).toBeLessThanOrEqual(FIGHT_ENTRY_MAX_DISTANCE);
    expect(away).toBeGreaterThanOrEqual(FIGHT_ENTRY_MIN_DISTANCE);
  });

  it("starts the Hero in the Ossuary within his Gravefire's range of Grave Wockington", () => {
    const { ossuary } = shippedWorld().areas;
    const fight = ossuary.entries.fight;
    const boss = ossuary.actBoss?.pos ?? { x: 0, y: 0 };

    expect(fight).toBeDefined();
    expect(Math.hypot(boss.x - fight.x, boss.y - fight.y)).toBeLessThanOrEqual(
      monsterTuning.grave_wockington.aggroRadius,
    );
  });

  it("is led to by no Exit", () => {
    const offenders = Object.entries(shippedWorld().areas).flatMap(
      ([name, area]) =>
        area.exits
          .filter((exit) => exit.entry === "fight")
          .map((exit) => `${name} -> ${exit.area}`),
    );
    expect(offenders).toEqual([]);
  });
});
