import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { areaDisplayNames, areas, tilesets } from "./content";
import type { Area, Exit, Spawn } from "./sim/area";
import { type MonsterOfLevel, monsterExperience } from "./sim/monsters";
import { findPath } from "./sim/path";
import type { Vec } from "./sim/vec";
import {
  createWorld,
  FRESH_PROGRESS,
  type Order,
  type SimEvent,
  step,
  type World,
} from "./sim/world";
import { ITEM_TYPES, itemOf } from "./tuning/items";
import type { MonsterType } from "./tuning/monsters";

// Building the World runs the loader's validation: a `start` Entry, Exits to
// an Entry that exists and can be reached from `start`, and spawns on tiles
// Monsters can stand on.
const shippedWorld = () => createWorld({ areas, tilesets, seed: 1 });

/**
 * Whether a Monster is as strong as one of its type at `monsterLevel`, by the
 * Experience it's worth, which differs at every Monster Level.
 */
const isAtMonsterLevel = (monsterLevel: number) => (monster: MonsterOfLevel) =>
  monsterExperience(monster) ===
  monsterExperience({ type: monster.type, monsterLevel });

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
          { name: "from-catacombs", type: "entry", x: 16, y: 16 },
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

/** The Combat Area that Town's one Exit leads to. */
const combatAreaOf = (world: World) =>
  world.areas[world.areas.town.exits[0].area];

/** An Area's Exit back to Town; throws when it has none. */
function exitToTown(area: Area): Exit {
  const exit = area.exits.find((exit) => exit.area === "town");
  if (!exit) throw new Error(`Area "${area.name}" has no Exit to Town`);
  return exit;
}

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
    expect(areaDisplayNames.town).toBe("Town");
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

  it("lead from Town through one Exit to a Combat Area of about 64×64", () => {
    const world = shippedWorld();
    const combat = combatAreaOf(world);

    expect(world.areas.town.exits).toHaveLength(1);
    expectAbout(combat.width, 64, 8);
    expectAbout(combat.height, 64, 8);
  });

  it("fill the Combat Area with 3–4 Skeleton groups, one about 7 strong, and 1–2 Zombie groups", () => {
    const combat = combatAreaOf(shippedWorld());
    const skeletons = packsOf(combat, "skeleton");
    const zombies = packsOf(combat, "zombie");

    expect(skeletons.length + zombies.length).toBe(combat.spawns.length);
    expectAbout(skeletons.length, 3.5, 0.5);
    expect(skeletons.some((count) => Math.abs(count - 7) <= 1)).toBe(true);
    expectAbout(zombies.length, 1.5, 0.5);
  });

  it("place Zombies in the Catacombs once the Hero gets there", () => {
    const world = shippedWorld();
    walkThrough(world, world.areas.town.exits[0]);

    expect(world.areaName).toBe("catacombs");
    expect(world.monsters.some((monster) => monster.type === "zombie")).toBe(
      true,
    );
  });

  it("give the Catacombs Area Level 1, so its Monsters spawn at Monster Level 1", () => {
    const world = shippedWorld();
    walkThrough(world, world.areas.town.exits[0]);

    expect(world.areas.town.areaLevel).toBeNull();
    expect(world.areas.catacombs.areaLevel).toBe(1);
    expect(world.areaName).toBe("catacombs");
    expect(world.monsters.length).toBeGreaterThan(0);
    expect(world.monsters.every(isAtMonsterLevel(1))).toBe(true);
  });

  it("put the Combat Area's Exit back to Town at its start", () => {
    const world = shippedWorld();
    const combat = combatAreaOf(world);
    const entry = combat.entries[world.areas.town.exits[0].entry];
    const centre = centreOf(exitToTown(combat));

    expect(Math.hypot(centre.x - entry.x, centre.y - entry.y)).toBeLessThan(4);
  });

  it("let the Hero walk from Town to the Combat Area and back", () => {
    const world = shippedWorld();
    const combat = combatAreaOf(world);
    const arrivedThere = walkThrough(world, world.areas.town.exits[0]);

    expect(arrivedThere?.area).toBe(combat.name);
    const arrivedHome = walkThrough(world, exitToTown(combat));

    expect(arrivedHome?.area).toBe("town");
    expect(world.areaName).toBe("town");
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

  it("give the Crypt Area Level 4, so its Monsters spawn at Monster Level 4", () => {
    const world = worldEntering("crypt", "start");

    expect(world.areas.crypt.areaLevel).toBe(4);
    expect(world.monsters.length).toBeGreaterThan(0);
    expect(world.monsters.every(isAtMonsterLevel(4))).toBe(true);
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

  it("give the Ossuary Area Level 8 and only an Exit back up to the Crypt", () => {
    const { ossuary } = shippedWorld().areas;

    expect(ossuary.areaLevel).toBe(8);
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

  it("spawn the Ossuary's Monsters at Monster Level 8", () => {
    const world = worldEntering("ossuary", "start");

    expect(world.monsters.length).toBeGreaterThan(0);
    expect(world.monsters.every(isAtMonsterLevel(8))).toBe(true);
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

  it("let the Hero walk from Town down through the Catacombs and the Crypt to the Ossuary, and back up to Town", () => {
    // Sturdy and strong enough to fight through every pack on the way.
    const progress = { ...FRESH_PROGRESS, strength: 200, vitality: 1000 };
    const world = createWorld({
      areas,
      tilesets,
      seed: 1,
      progress,
    });
    const route: [from: string, to: string][] = [
      ["town", "catacombs"],
      ["catacombs", "crypt"],
      ["crypt", "ossuary"],
      ["ossuary", "crypt"],
      ["crypt", "catacombs"],
      ["catacombs", "town"],
    ];

    for (const [from, to] of route) {
      expect(world.areaName).toBe(from);
      const arrived = fightThrough(world, exitTo(world.areas[from], to));
      expect(arrived?.area).toBe(to);
    }
    expect(world.areaName).toBe("town");
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
      "Ring of Strength": "Str",
      "Ring of Dexterity": "Dex",
      "Ring of Life": "Life",
      "Amulet of Vitality": "Vit",
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
  const names = ["town", "catacombs", "crypt", "ossuary"];
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
      expect(["floor", "wall", "prop"]).toContain(property(tile, "kind"));
    }
  });

  it("has a thumbnail and an imported model for every tile", () => {
    for (const tile of tiles) {
      expect(existsSync(`content/tilesets/${tile.image}`)).toBe(true);
      expect(
        existsSync(`public/assets/models/${property(tile, "piece")}.glb`),
      ).toBe(true);
    }
  });

  it("never lets a floor block", () => {
    for (const tile of tiles) {
      if (property(tile, "kind") === "floor") {
        expect(property(tile, "blocks")).toBe(false);
      }
    }
  });
});
