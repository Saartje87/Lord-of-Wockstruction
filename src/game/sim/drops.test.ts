import { afterEach, describe, expect, it } from "vitest";
import { dropTuning, ITEM_TYPES, type ItemType } from "../tuning/items";
import { type Belongings, inventoryOf } from "./inventory";
import { combatArea } from "./testAreas";
import {
  createWorld,
  FRESH_PROGRESS,
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

/**
 * A Town with the Hero next to a pack of `pack` Skeletons, with enough
 * Vitality to see a bigger pack off.
 */
function town({
  seed = 1,
  pack = 1,
  belongings,
}: {
  seed?: number;
  pack?: number;
  belongings?: Belongings;
} = {}): World {
  const progress = pack > 1 ? { ...FRESH_PROGRESS, vitality: 200 } : null;
  const areas = { town: map(["H.S.."], { pack }) };
  return createWorld({ areas, seed, belongings, progress });
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
function dropping(
  type: ItemType = "ringOfLife",
  belongings?: Belongings,
  pack = 1,
) {
  dropTuning.chance = 1;
  dropTuning.items = [type];
  return town({ belongings, pack });
}

/** Kills one Monster and returns the Item it dropped. */
function killForDrop(world: World) {
  const [dropped] = ofType(kill(world, 1), "ItemDropped");
  if (!dropped) throw new Error("Nothing dropped");
  return dropped;
}

/** Orders a pickup and steps until the Hero gets there, returning the events. */
function pickUp(world: World, groundItem: number): SimEvent[] {
  const events = step(world, [{ type: "PickUp", groundItem }]);
  for (let i = 0; i < 60 * 10; i++) {
    const done = events.some(
      (event) => event.type === "ItemPickedUp" || event.type === "NoRoom",
    );
    if (done) return events;
    events.push(...step(world, []));
  }
  throw new Error("Never got to the Ground Item");
}

/** Items of `type` along `row`, with their top-left in each of `columns`. */
function inRow(type: ItemType, row: number, columns: number[]) {
  return columns.map((column) => ({ type, cell: { column, row } }));
}

describe("Picking up", () => {
  it("walks the Hero to the Ground Item and puts it in the Inventory", () => {
    const world = dropping("ringOfLife", { inventory: [], equipment: {} });
    const { item, pos } = killForDrop(world);
    step(world, [{ type: "MoveTo", target: { x: 0.5, y: 0.5 } }]);
    for (let i = 0; i < 120; i++) step(world, []);
    expect(gap(world, pos)).toBeGreaterThan(1.5);

    const events = pickUp(world, item.id);

    expect(ofType(events, "ItemPickedUp")).toEqual([
      { type: "ItemPickedUp", item, cell: { column: 0, row: 0 } },
    ]);
    expect(gap(world, pos)).toBeLessThan(1);
    expect(groundItemsOf(world)).toEqual([]);
    expect(inventoryOf(world)).toEqual([{ item, cell: { column: 0, row: 0 } }]);
  });

  it("fills the first free spot column by column from the top-left", () => {
    const belongings: Belongings = {
      inventory: inRow("ringOfStrength", 0, [0]),
      equipment: {},
    };
    const world = dropping("ringOfLife", belongings, 4);
    const dropped = ofType(kill(world, 4), "ItemDropped");
    const cells = [];
    for (const { item } of dropped) {
      const [picked] = ofType(pickUp(world, item.id), "ItemPickedUp");
      cells.push(picked.cell);
    }

    expect(cells).toEqual([
      { column: 0, row: 1 },
      { column: 0, row: 2 },
      { column: 0, row: 3 },
      { column: 1, row: 0 },
    ]);
  });

  it("keeps a sized Item on the grid, finding room at its far edge", () => {
    const belongings: Belongings = {
      inventory: [
        ...inRow("ringOfStrength", 1, [0]),
        ...inRow("axe", 0, [1, 3, 5, 7]),
      ],
      equipment: {},
    };
    const world = dropping("shortSword", belongings);
    const { item } = killForDrop(world);

    const [picked] = ofType(pickUp(world, item.id), "ItemPickedUp");

    // Not under the Ring in column 0, where it would hang off the bottom.
    expect(picked.cell).toEqual({ column: 9, row: 0 });
  });

  it("leaves the Item on the ground with No room when it doesn't fit", () => {
    const full: Belongings = {
      inventory: [
        ...inRow("axe", 0, [0, 2, 4, 6, 8]),
        ...inRow("ringOfLife", 3, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
      ],
      equipment: {},
    };
    const world = dropping("ringOfStrength", full);
    const dropped = killForDrop(world);
    const before = inventoryOf(world);

    const events = pickUp(world, dropped.item.id);

    expect(ofType(events, "NoRoom")).toEqual([{ type: "NoRoom" }]);
    expect(ofType(events, "ItemPickedUp")).toEqual([]);
    expect(groundItemsOf(world)).toEqual([
      { item: dropped.item, pos: dropped.pos },
    ]);
    expect(inventoryOf(world)).toEqual(before);
  });
});

describe("Leaving the Area", () => {
  it("clears its Ground Items, which aren't there on coming back", () => {
    dropTuning.chance = 1;
    const world = createWorld({
      areas: {
        town: map(["H.S.E"], { exitTo: "cave" }),
        cave: combatArea(map(["H..E"], { exitTo: "town" })),
      },
      seed: 1,
    });
    killForDrop(world);
    expect(groundItemsOf(world)).toHaveLength(1);

    walkThrough(world, { x: 4.5, y: 0.5 });
    expect(world.areaName).toBe("cave");
    expect(groundItemsOf(world)).toEqual([]);

    walkThrough(world, { x: 3.5, y: 0.5 });
    expect(world.areaName).toBe("town");
    expect(groundItemsOf(world)).toEqual([]);
  });
});

/** Walks the Hero into an Exit at `target` and on through the whole change. */
function walkThrough(world: World, target: { x: number; y: number }) {
  step(world, [{ type: "MoveTo", target }]);
  for (let i = 0; world.areaChange === null; i++) {
    if (i > 60 * 10) throw new Error("Never reached the Exit");
    step(world, []);
  }
  while (world.areaChange !== null) step(world, []);
}
