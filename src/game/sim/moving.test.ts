import { describe, expect, it } from "vitest";
import type { ItemType } from "../tuning/items";
import { emptyBelt } from "./belt";
import {
  type Belongings,
  belongingsOf,
  cursorItemOf,
  inventoryOf,
  placement,
} from "./inventory";
import { combatArea } from "./testAreas";
import {
  createWorld,
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
  const objects: object[] = [];
  [...rows.join("")].forEach((cell, i) => {
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

/** An Item of `type` with its top-left at `column`, `row`. */
const at = (type: ItemType, column: number, row: number) => ({
  type,
  cell: { column, row },
});

/**
 * A World whose Hero carries `inventory` and wears nothing, in a Town of
 * open floor, or of `areas` if given.
 */
function carrying(
  inventory: Belongings["inventory"],
  areas: Record<string, unknown> = { town: map(["H.."]) },
  belt: ItemType[][] = emptyBelt(),
): World {
  return createWorld({
    areas,
    seed: 1,
    belongings: { inventory, equipment: {}, belt },
  });
}

/** The Items on the grid by type and top-left cell. */
const layout = (world: World) =>
  inventoryOf(world).map(({ item, cell }) => ({ type: item.type, cell }));

const ofType = <T extends SimEvent["type"]>(events: SimEvent[], type: T) =>
  events.filter(
    (event): event is Extract<SimEvent, { type: T }> => event.type === type,
  );

describe("Lifting an Item", () => {
  it("takes it off the grid onto the cursor, from any cell it covers", () => {
    const world = carrying([at("axe", 2, 1), at("ring", 0, 0)]);
    const [axe] = inventoryOf(world);

    const events = step(world, [
      { type: "LiftItem", from: { column: 3, row: 3 } },
    ]);

    expect(cursorItemOf(world)).toEqual({
      item: axe.item,
      from: { column: 2, row: 1 },
    });
    expect(inventoryOf(world).map(({ item }) => item.type)).toEqual(["ring"]);
    expect(ofType(events, "InventoryChanged")).toHaveLength(1);
  });

  it("does nothing on a free cell", () => {
    const world = carrying([at("ring", 0, 0)]);

    const events = step(world, [
      { type: "LiftItem", from: { column: 1, row: 0 } },
    ]);

    expect(cursorItemOf(world)).toBeNull();
    expect(layout(world)).toEqual([at("ring", 0, 0)]);
    expect(ofType(events, "InventoryChanged")).toEqual([]);
  });
});

/** Lifts the Item covering `column`, `row` onto the cursor. */
function lift(world: World, column: number, row: number) {
  step(world, [{ type: "LiftItem", from: { column, row } }]);
  if (!cursorItemOf(world)) throw new Error("Nothing lifted");
}

/** Puts the cursor Item down with its top-left at `column`, `row`. */
const place = (world: World, column: number, row: number) =>
  step(world, [{ type: "PlaceItem", to: { column, row } }]);

/** Ten Rings of Life filling row `row`. */
const ringRow = (row: number) =>
  Array.from({ length: 10 }, (_, column) => at("ring", column, row));

describe("Placing the cursor Item", () => {
  it("puts it down with its top-left at the cell", () => {
    const world = carrying([at("axe", 0, 0), at("ring", 9, 3)]);
    lift(world, 0, 0);

    expect(placement(world, { column: 4, row: 1 })).toBe("fits");
    const events = place(world, 4, 1);

    expect(cursorItemOf(world)).toBeNull();
    expect(layout(world)).toEqual([at("ring", 9, 3), at("axe", 4, 1)]);
    expect(ofType(events, "InventoryChanged")).toHaveLength(1);
  });

  it("fits right up against the grid's far edges", () => {
    const world = carrying([at("axe", 0, 0)]);
    lift(world, 0, 0);

    expect(placement(world, { column: 8, row: 1 })).toBe("fits");
    place(world, 8, 1);

    expect(layout(world)).toEqual([at("axe", 8, 1)]);
  });

  it("swaps with the one Item in the way, which goes onto the cursor", () => {
    const world = carrying([at("ring", 0, 0), at("axe", 4, 0)]);
    const [, axe] = inventoryOf(world);
    lift(world, 0, 0);

    expect(placement(world, { column: 5, row: 2 })).toBe("swap");
    const events = place(world, 5, 2);

    expect(layout(world)).toEqual([at("ring", 5, 2)]);
    // Never put down, the Axe would go where the Ring came from.
    expect(cursorItemOf(world)).toEqual({
      item: axe.item,
      from: { column: 0, row: 0 },
    });
    expect(ofType(events, "InventoryChanged")).toHaveLength(1);
  });

  it("gives a swapped-out Item the first free spot if it can't take the other's", () => {
    // The Ring comes from the bottom row, where the Axe would hang off.
    const world = carrying([
      ...ringRow(0).slice(0, 2),
      at("ring", 0, 3),
      at("axe", 4, 0),
    ]);
    lift(world, 0, 3);

    place(world, 4, 0);

    expect(cursorItemOf(world)?.from).toEqual({ column: 0, row: 1 });
  });

  it("refuses a swap when the swapped-out Item could go nowhere", () => {
    // Full but for the Axe's spot and one cell.
    const world = carrying([
      ...ringRow(0).slice(2),
      ...ringRow(1).slice(2),
      ...ringRow(2).slice(2),
      ...ringRow(3),
      at("axe", 0, 0),
    ]);
    lift(world, 2, 0);

    expect(placement(world, { column: 0, row: 0 })).toBeNull();
    expect(place(world, 0, 0)).toEqual([]);
    expect(cursorItemOf(world)?.item.type).toBe("ring");
  });

  it("refuses a spot over two or more Items", () => {
    const world = carrying([
      at("axe", 0, 0),
      at("ring", 4, 0),
      at("ring", 5, 1),
    ]);
    lift(world, 0, 0);

    expect(placement(world, { column: 4, row: 0 })).toBeNull();
    const events = place(world, 4, 0);

    expect(cursorItemOf(world)?.item.type).toBe("axe");
    expect(layout(world)).toEqual([at("ring", 4, 0), at("ring", 5, 1)]);
    expect(events).toEqual([]);
  });

  it("refuses a spot hanging off the grid", () => {
    const world = carrying([at("axe", 0, 0)]);
    lift(world, 0, 0);

    for (const [column, row] of [
      [9, 0],
      [0, 2],
      [-1, 0],
      [0, -1],
    ]) {
      expect(placement(world, { column, row })).toBeNull();
      expect(place(world, column, row)).toEqual([]);
    }
    expect(cursorItemOf(world)?.item.type).toBe("axe");
  });

  it("does nothing with an empty cursor", () => {
    const world = carrying([at("axe", 0, 0)]);

    expect(placement(world, { column: 4, row: 0 })).toBeNull();
    expect(place(world, 4, 0)).toEqual([]);
    expect(layout(world)).toEqual([at("axe", 0, 0)]);
  });
});

describe("Dropping the cursor Item", () => {
  it("lays it on the ground at the Hero's feet", () => {
    const world = carrying([at("axe", 0, 0)]);
    const [axe] = inventoryOf(world);
    lift(world, 0, 0);

    const events = step(world, [{ type: "DropItem" }]);

    const pos = world.hero.pos;
    expect(groundItemsOf(world)).toEqual([{ item: axe.item, pos }]);
    expect(ofType(events, "ItemDropped")).toEqual([
      { type: "ItemDropped", item: axe.item, pos },
    ]);
    expect(ofType(events, "InventoryChanged")).toHaveLength(1);
    expect(cursorItemOf(world)).toBeNull();
    expect(layout(world)).toEqual([]);
  });

  it("does nothing with an empty cursor", () => {
    const world = carrying([at("axe", 0, 0)]);

    expect(step(world, [{ type: "DropItem" }])).toEqual([]);
    expect(groundItemsOf(world)).toEqual([]);
  });
});

describe("A held Item going back", () => {
  it("goes back where it was lifted from on ReturnCursorItem", () => {
    const world = carrying([at("axe", 2, 1)]);
    lift(world, 3, 2);

    const events = step(world, [{ type: "ReturnCursorItem" }]);

    expect(cursorItemOf(world)).toBeNull();
    expect(layout(world)).toEqual([at("axe", 2, 1)]);
    expect(ofType(events, "InventoryChanged")).toHaveLength(1);
    expect(step(world, [{ type: "ReturnCursorItem" }])).toEqual([]);
  });

  it("goes back to the spot a swap gave it", () => {
    const world = carrying([at("ring", 0, 0), at("axe", 4, 0)]);
    lift(world, 0, 0);
    place(world, 4, 0);

    step(world, [{ type: "ReturnCursorItem" }]);

    expect(layout(world)).toEqual([at("ring", 4, 0), at("axe", 0, 0)]);
  });

  it("goes back when the Hero dies", () => {
    const areas = { town: map(["H.S"], { pack: 7 }) };
    const world = carrying([at("axe", 2, 1)], areas);
    lift(world, 2, 1);

    let died = false;
    for (let i = 0; !died; i++) {
      if (i > 60 * 60) throw new Error("The Hero never died");
      died = step(world, []).some((event) => event.type === "HeroDied");
    }

    expect(cursorItemOf(world)).toBeNull();
    expect(layout(world)).toEqual([at("axe", 2, 1)]);
  });

  it("goes back when the Hero walks into an Exit", () => {
    const areas = {
      town: map(["H.E"], { exitTo: "cave" }),
      cave: combatArea(map(["H.."])),
    };
    const world = carrying([at("axe", 2, 1)], areas);
    lift(world, 2, 1);

    step(world, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
    for (let i = 0; world.areaChange === null; i++) {
      if (i > 60 * 10) throw new Error("Never reached the Exit");
      step(world, []);
    }

    expect(cursorItemOf(world)).toBeNull();
    expect(layout(world)).toEqual([at("axe", 2, 1)]);
  });

  it("goes back to its Belt Column when the Hero dies or walks into an Exit, if it was a Potion lifted from the bottom row", () => {
    const deadly = { town: map(["H.S"], { pack: 7 }) };
    const exit = {
      town: map(["H.E"], { exitTo: "cave" }),
      cave: combatArea(map(["H.."])),
    };
    for (const areas of [deadly, exit]) {
      const world = carrying([], areas, [["lifePotion"], [], [], []]);
      step(world, [{ type: "LiftItem", from: { beltColumn: 0, row: 0 } }]);
      if (areas === exit) {
        step(world, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
      }

      for (let i = 0; world.death === null && world.areaChange === null; i++) {
        if (i > 60 * 60) throw new Error("The Hero neither died nor left");
        step(world, []);
      }

      expect(cursorItemOf(world)).toBeNull();
      expect(belongingsOf(world).belt[0]).toEqual(["lifePotion"]);
    }
  });

  it("keeps its spot free from Items picked up meanwhile", () => {
    const world = carrying([at("ring", 0, 0), at("ring", 0, 1)]);
    const [life] = inventoryOf(world);
    lift(world, 0, 0);
    step(world, [{ type: "DropItem" }]);
    // The Ring of Strength, moved up and lifted again, goes back to (0, 0),
    // the first free spot.
    lift(world, 0, 1);
    place(world, 0, 0);
    lift(world, 0, 0);

    const events = step(world, [{ type: "PickUp", groundItem: life.item.id }]);

    expect(ofType(events, "ItemPickedUp")).toEqual([
      { type: "ItemPickedUp", item: life.item, cell: { column: 0, row: 1 } },
    ]);
  });
});

describe("The Save of a held Item", () => {
  it("keeps it at the spot it would go back to", () => {
    const world = carrying([at("ring", 0, 0), at("axe", 4, 0)]);
    const before = belongingsOf(world);
    lift(world, 4, 0);

    expect(belongingsOf(world)).toEqual(before);

    place(world, 0, 0);
    expect(belongingsOf(world).inventory).toEqual([
      at("axe", 0, 0),
      // The Ring, swapped out, would go back where the Axe came from.
      at("ring", 4, 0),
    ]);
  });
});
