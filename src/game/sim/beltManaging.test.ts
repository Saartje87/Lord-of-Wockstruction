import { afterEach, describe, expect, it } from "vitest";
import { beltTuning, type ItemType } from "../tuning/items";
import { beltOf, beltTypesOf } from "./belt";
import {
  type Belongings,
  belongingsOf,
  cursorItemOf,
  inventoryOf,
} from "./inventory";
import { createWorld, type SimEvent, step, type World } from "./world";

/** A Town of open floor three tiles wide, the Hero's `start` on the first. */
const town = {
  orientation: "orthogonal",
  width: 3,
  height: 1,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "floor", width: 3, height: 1, data: [1, 1, 1] },
    {
      type: "objectgroup",
      name: "objects",
      objects: [{ name: "start", type: "entry", point: true, x: 16, y: 16 }],
    },
  ],
};

/** A World whose Hero has `belt` in the Belt Columns and carries `inventory`. */
function carrying(
  belt: ItemType[][],
  inventory: Belongings["inventory"] = [],
): World {
  return createWorld({
    areas: { town },
    seed: 1,
    belongings: {
      inventory,
      equipment: { weapon: { type: "shortSword" } },
      belt,
    },
  });
}

/** A Belt Column cell: `row` 0 is the bottom one. */
const belt = (column: number, row: number) => ({ beltColumn: column, row });

const types = (events: SimEvent[]) => events.map((event) => event.type);

const ofType = <T extends SimEvent["type"]>(events: SimEvent[], type: T) =>
  events.filter(
    (event): event is Extract<SimEvent, { type: T }> => event.type === type,
  );

const tunedBelt = { ...beltTuning };
afterEach(() => {
  Object.assign(beltTuning, tunedBelt);
});

describe("lifting a Potion out of a Belt Column", () => {
  it("makes it the Held Item, the Potions above dropping down a row", () => {
    beltTuning.rowsWithoutBelt = 4;
    const world = carrying([
      ["lifePotion", "lifePotion", "lifePotion"],
      [],
      [],
      [],
    ]);
    const [, lifted] = beltOf(world)[0];

    const events = step(world, [{ type: "LiftItem", from: belt(0, 1) }]);

    expect(cursorItemOf(world)?.item).toEqual(lifted);
    expect(beltOf(world)[0]).toHaveLength(2);
    expect(beltOf(world)[0].map((item) => item.id)).not.toContain(lifted.id);
    expect(types(events)).toContain("BeltChanged");
  });
});

describe("putting a Potion into a Belt Column", () => {
  it("lands it at the lowest free row, whatever row it's put at", () => {
    beltTuning.rowsWithoutBelt = 4;
    const world = carrying(
      [["lifePotion"], ["lifePotion"], [], []],
      [{ type: "lifePotion", cell: { column: 0, row: 0 } }],
    );
    step(world, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);
    const held = cursorItemOf(world)?.item;

    const events = step(world, [{ type: "PlaceItem", to: belt(1, 3) }]);

    expect(cursorItemOf(world)).toBeNull();
    expect(beltOf(world)[1][1]).toEqual(held);
    expect(beltTypesOf(world)[1]).toEqual(["lifePotion", "lifePotion"]);
    expect(types(events)).toContain("BeltChanged");
  });

  it("is refused by a full column", () => {
    beltTuning.rowsWithoutBelt = 2;
    const world = carrying(
      [["lifePotion", "lifePotion"], [], [], []],
      [{ type: "lifePotion", cell: { column: 0, row: 0 } }],
    );
    step(world, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);

    step(world, [{ type: "PlaceItem", to: belt(0, 0) }]);

    expect(cursorItemOf(world)).not.toBeNull();
    expect(beltTypesOf(world)[0]).toHaveLength(2);
  });

  it("can go back into the column it was lifted from, or into another", () => {
    beltTuning.rowsWithoutBelt = 2;
    const world = carrying([["lifePotion", "lifePotion"], [], [], []]);
    const [bottom] = beltOf(world)[0];

    step(world, [{ type: "LiftItem", from: belt(0, 0) }]);
    step(world, [{ type: "PlaceItem", to: belt(0, 0) }]);
    expect(beltOf(world)[0][1]).toEqual(bottom);

    step(world, [{ type: "LiftItem", from: belt(0, 1) }]);
    step(world, [{ type: "PlaceItem", to: belt(3, 1) }]);
    expect(beltOf(world)[3]).toEqual([bottom]);
    expect(beltOf(world)[0]).toHaveLength(1);
  });

  it("mixes Potion types within a column", () => {
    beltTuning.rowsWithoutBelt = 3;
    const world = carrying(
      [["lifePotion"], [], [], []],
      [
        { type: "manaPotion", cell: { column: 0, row: 0 } },
        { type: "rejuvenationPotion", cell: { column: 1, row: 0 } },
      ],
    );

    step(world, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);
    step(world, [{ type: "PlaceItem", to: belt(0, 0) }]);
    step(world, [{ type: "LiftItem", from: { column: 1, row: 0 } }]);
    step(world, [{ type: "PlaceItem", to: belt(0, 2) }]);

    expect(beltTypesOf(world)[0]).toEqual([
      "lifePotion",
      "manaPotion",
      "rejuvenationPotion",
    ]);
  });

  it("refuses an Item that isn't a Potion", () => {
    const world = carrying(
      [[], [], [], []],
      [{ type: "ringOfLife", cell: { column: 0, row: 0 } }],
    );
    step(world, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);

    step(world, [{ type: "PlaceItem", to: belt(0, 0) }]);

    expect(cursorItemOf(world)?.item.type).toBe("ringOfLife");
    expect(beltTypesOf(world)[0]).toEqual([]);
  });
});

describe("moving Potions between the Belt, the Inventory and the ground", () => {
  it("puts a Potion lifted from the Belt into the Inventory", () => {
    const world = carrying([["lifePotion"], [], [], []]);

    step(world, [{ type: "LiftItem", from: belt(0, 0) }]);
    step(world, [{ type: "PlaceItem", to: { column: 2, row: 1 } }]);

    expect(beltTypesOf(world)[0]).toEqual([]);
    expect(belongingsOf(world).inventory).toEqual([
      { type: "lifePotion", cell: { column: 2, row: 1 } },
    ]);
  });

  it("lays a Potion lifted from the Belt on the ground", () => {
    const world = carrying([["lifePotion"], [], [], []]);

    step(world, [{ type: "LiftItem", from: belt(0, 0) }]);
    const events = step(world, [{ type: "DropItem" }]);

    expect(types(events)).toContain("ItemDropped");
    expect(cursorItemOf(world)).toBeNull();
    expect(belongingsOf(world).belt).toEqual([[], [], [], []]);
  });

  it("swaps a Potion from the Belt with an Inventory Potion, which goes back to the Belt Column", () => {
    const world = carrying(
      [["lifePotion"], [], [], []],
      [{ type: "lifePotion", cell: { column: 4, row: 2 } }],
    );
    const [fromBelt] = beltOf(world)[0];
    const [{ item: fromInventory }] = inventoryOf(world);

    step(world, [{ type: "LiftItem", from: belt(0, 0) }]);
    step(world, [{ type: "PlaceItem", to: { column: 4, row: 2 } }]);

    expect(cursorItemOf(world)?.item).toEqual(fromInventory);
    expect(belongingsOf(world).belt?.[0]).toEqual(["lifePotion"]);
    step(world, [{ type: "ReturnCursorItem" }]);
    expect(beltOf(world)[0]).toEqual([fromInventory]);
    expect(inventoryOf(world).map(({ item }) => item)).toEqual([fromBelt]);
  });
});

describe("a Held Item lifted from the Belt", () => {
  it("is kept by the Save as still in its Belt Column, at its row", () => {
    beltTuning.rowsWithoutBelt = 3;
    const world = carrying([
      ["lifePotion", "lifePotion", "lifePotion"],
      [],
      [],
      [],
    ]);

    step(world, [{ type: "LiftItem", from: belt(0, 1) }]);

    expect(belongingsOf(world).belt?.[0]).toHaveLength(3);
  });

  it("goes back to its row when it's never put down", () => {
    beltTuning.rowsWithoutBelt = 3;
    const world = carrying([
      ["lifePotion", "lifePotion", "lifePotion"],
      [],
      [],
      [],
    ]);
    const before = beltOf(world)[0];

    step(world, [{ type: "LiftItem", from: belt(0, 1) }]);
    step(world, [{ type: "ReturnCursorItem" }]);

    expect(beltOf(world)[0]).toEqual(before);
    expect(cursorItemOf(world)).toBeNull();
  });

  it("keeps its row: a Potion picked up meanwhile can't take it", () => {
    const world = carrying([
      ["lifePotion"],
      ["lifePotion"],
      [],
      ["lifePotion"],
    ]);
    // Leave a Potion from the second column lying at the Hero's feet.
    step(world, [{ type: "LiftItem", from: belt(1, 0) }]);
    const [dropped] = ofType(
      step(world, [{ type: "DropItem" }]),
      "ItemDropped",
    );
    step(world, [{ type: "LiftItem", from: belt(0, 0) }]);

    const events = step(world, [
      { type: "PickUp", groundItem: dropped.item.id },
    ]);

    expect(ofType(events, "PotionPickedUp")).toEqual([
      { type: "PotionPickedUp", item: dropped.item, column: 1 },
    ]);
    step(world, [{ type: "ReturnCursorItem" }]);
    expect(beltTypesOf(world)).toEqual([
      ["lifePotion"],
      ["lifePotion"],
      [],
      ["lifePotion"],
    ]);
  });

  it("counts as the bottom Potion of its column for a Potion picked up meanwhile", () => {
    beltTuning.rowsWithoutBelt = 2;
    const world = carrying(
      [["lifePotion"], [], [], []],
      [{ type: "lifePotion", cell: { column: 0, row: 0 } }],
    );
    // Leave the Inventory Potion lying at the Hero's feet.
    step(world, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);
    const [dropped] = ofType(
      step(world, [{ type: "DropItem" }]),
      "ItemDropped",
    );
    step(world, [{ type: "LiftItem", from: belt(0, 0) }]);

    const events = step(world, [
      { type: "PickUp", groundItem: dropped.item.id },
    ]);

    expect(ofType(events, "PotionPickedUp")[0]?.column).toBe(0);
  });
});
