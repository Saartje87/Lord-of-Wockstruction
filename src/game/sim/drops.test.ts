import { afterEach, describe, expect, it } from "vitest";
import { dropTuning, ITEM_TYPES, type ItemType } from "../tuning/items";
import {
  createWorld,
  type Gear,
  groundItemsOf,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area of open floor drawn row by row: `.` floor, `H` the
 * Hero's `start`, `S` a pack of `pack` Skeletons and `E` an Exit to `exitTo`'s
 * `start`, each in the middle of its tile.
 */
function map(rows: string[], { pack = 1, exitTo = "" } = {}) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const objects: object[] = [];
  [...cells].forEach((cell, i) => {
    const column = i % width;
    const row = Math.floor(i / width);
    const x = (column + 0.5) * 32;
    const y = (row + 0.5) * 32;
    if (cell === "H") {
      objects.push({ name: "start", type: "entry", point: true, x, y });
    }
    if (cell === "S") {
      objects.push({
        name: "",
        type: "monsterSpawn",
        point: true,
        x,
        y,
        properties: [
          { name: "monster", type: "string", value: "skeleton" },
          { name: "count", type: "int", value: pack },
        ],
      });
    }
    if (cell === "E") {
      objects.push({
        name: "",
        type: "exit",
        x: column * 32,
        y: row * 32,
        width: 32,
        height: 32,
        properties: [
          { name: "area", type: "string", value: exitTo },
          { name: "entry", type: "string", value: "start" },
        ],
      });
    }
  });
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

/** A Town with the Hero next to a pack of `pack` Skeletons. */
function town({
  seed = 1,
  pack = 1,
  gear,
}: {
  seed?: number;
  pack?: number;
  gear?: Gear;
} = {}): World {
  return createWorld({ areas: { town: map(["H.S.."], { pack }) }, seed, gear });
}

/**
 * Attacks the nearest Monster until `kills` have died, returning every
 * event on the way.
 */
function kill(world: World, kills: number): SimEvent[] {
  const all: SimEvent[] = [];
  let died = 0;
  for (let i = 0; died < kills; i++) {
    if (i > 60 * 60) throw new Error(`Only ${died} of ${kills} kills`);
    const [nearest] = [...world.monsters].sort(
      (a, b) => gap(world, a.pos) - gap(world, b.pos),
    );
    const events = step(world, [{ type: "Attack", monster: nearest.id }]);
    died += events.filter((event) => event.type === "MonsterDied").length;
    all.push(...events);
  }
  return all;
}

function gap(world: World, pos: { x: number; y: number }): number {
  return Math.hypot(pos.x - world.hero.pos.x, pos.y - world.hero.pos.y);
}

const ofType = <T extends SimEvent["type"]>(events: SimEvent[], type: T) =>
  events.filter(
    (event): event is Extract<SimEvent, { type: T }> => event.type === type,
  );

describe("Drops", () => {
  it("come from about a quarter of kills, one Item each, of every type", () => {
    let drops = 0;
    const types = new Set<ItemType>();
    const kills = 200;
    for (let seed = 1; seed <= kills; seed++) {
      const dropped = ofType(kill(town({ seed }), 1), "ItemDropped");
      expect(dropped.length).toBeLessThanOrEqual(1);
      drops += dropped.length;
      for (const { item } of dropped) types.add(item.type);
    }

    expect(drops / kills).toBeGreaterThan(0.18);
    expect(drops / kills).toBeLessThan(0.32);
    expect([...types].sort()).toEqual([...ITEM_TYPES].sort());
  });

  it("lie where the Monster died as Ground Items", () => {
    const world = dropping();
    const [skeleton] = world.monsters;
    let diedAt = { ...skeleton.pos };
    const events: SimEvent[] = [];
    while (!events.some((event) => event.type === "MonsterDied")) {
      diedAt = { ...skeleton.pos };
      events.push(...step(world, [{ type: "Attack", monster: skeleton.id }]));
    }

    const [dropped] = ofType(events, "ItemDropped");
    expect(dropped.pos).toEqual(diedAt);
    expect(groundItemsOf(world)).toEqual([{ item: dropped.item, pos: diedAt }]);
  });
});

/** The tuning tests change, put back after each. */
const tuned = { ...dropTuning };
afterEach(() => {
  Object.assign(dropTuning, tuned);
});

/** A Town where every kill drops an Item of `type`. */
function dropping(type: ItemType = "ringOfLife", gear?: Gear, pack = 1) {
  dropTuning.chance = 1;
  dropTuning.items = [type];
  return town({ gear, pack });
}
