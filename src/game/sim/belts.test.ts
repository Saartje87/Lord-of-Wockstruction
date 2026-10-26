import { describe, expect, it } from "vitest";
import { type ItemType, inventoryTuning } from "../tuning/items";
import { beltRows, beltTypesOf, emptyBelt } from "./belt";
import {
  type Belongings,
  type Cell,
  cursorItemOf,
  EQUIPMENT_SLOTS,
  equipmentOf,
  inventoryItemAt,
  inventoryOf,
  placement,
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

/** A World whose Hero has these Belongings, a Short Sword in hand. */
function holding({
  equipment = {},
  inventory = [],
  belt = emptyBelt(),
}: Partial<Belongings>): World {
  return createWorld({
    areas: { town },
    seed: 1,
    belongings: {
      inventory,
      equipment: { weapon: "shortSword", ...equipment },
      belt,
    },
  });
}

/** An Inventory Item of `type` with its top-left at a cell. */
const at = (type: ItemType, column: number, row: number) => ({
  type,
  cell: { column, row },
});

/** An Inventory filled with Rings in every cell but `free`. */
function filledBut(free: Cell[]): Belongings["inventory"] {
  const rings: Belongings["inventory"] = [];
  for (let column = 0; column < inventoryTuning.columns; column++) {
    for (let row = 0; row < inventoryTuning.rows; row++) {
      const left = free.some(
        (cell) => cell.column === column && cell.row === row,
      );
      if (!left) rings.push(at("ringOfLife", column, row));
    }
  }
  return rings;
}

const types = (events: SimEvent[]) => events.map((event) => event.type);

describe("the Belt slot", () => {
  it("is one of the Equipment slots", () => {
    expect(EQUIPMENT_SLOTS).toContain("belt");
  });

  it("takes a Belt from the Inventory", () => {
    const world = holding({ inventory: [at("sash", 0, 0)] });
    const sash = inventoryItemAt(world, { column: 0, row: 0 })?.item;

    const events = step(world, [{ type: "EquipItem", item: sash?.id ?? -1 }]);

    expect(equipmentOf(world).belt).toEqual(sash);
    expect(types(events)).toContain("ItemEquipped");
  });

  it("takes nothing but a Belt", () => {
    const world = holding({ inventory: [at("ringOfLife", 0, 0)] });

    step(world, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);
    step(world, [{ type: "PlaceItem", to: "belt" }]);

    expect(equipmentOf(world).belt).toBeNull();
  });
});

describe("the rows of the Belt Columns", () => {
  it("are one with no Belt Equipped", () => {
    expect(beltRows(holding({}))).toBe(1);
  });

  it.each([
    ["sash", 2],
    ["heavyBelt", 3],
    ["platedBelt", 4],
  ] as const)("are those of the Equipped Belt: %s gives %i", (belt, rows) => {
    expect(beltRows(holding({ equipment: { belt } }))).toBe(rows);
  });
});

/** Potion types in an Inventory, sorted. */
const carried = (world: World) =>
  inventoryOf(world)
    .map(({ item }) => item.type)
    .sort();

describe("taking the Belt off", () => {
  it("moves the Potions in rows that no longer exist into the Inventory", () => {
    const world = holding({
      equipment: { belt: "sash" },
      belt: [["lifePotion", "manaPotion"], ["lifePotion"], [], ["manaPotion"]],
    });

    const events = step(world, [{ type: "UnequipItem", slot: "belt" }]);

    expect(equipmentOf(world).belt).toBeNull();
    expect(beltTypesOf(world)).toEqual([
      ["lifePotion"],
      ["lifePotion"],
      [],
      ["manaPotion"],
    ]);
    expect(carried(world)).toEqual(["manaPotion", "sash"]);
    expect(types(events)).toEqual(
      expect.arrayContaining(["ItemUnequipped", "BeltChanged"]),
    );
  });

  it("is refused with No room, nothing moving, when those Potions don't all fit", () => {
    const world = holding({
      equipment: { belt: "sash" },
      // Room for the Sash but not for a Potion besides.
      inventory: filledBut([
        { column: 0, row: 0 },
        { column: 1, row: 0 },
      ]),
      belt: [["lifePotion", "manaPotion"], [], [], []],
    });
    const before = inventoryOf(world);

    const events = step(world, [{ type: "UnequipItem", slot: "belt" }]);

    expect(types(events)).toEqual(["NoRoom"]);
    expect(equipmentOf(world).belt?.type).toBe("sash");
    expect(beltTypesOf(world)).toEqual([
      ["lifePotion", "manaPotion"],
      [],
      [],
      [],
    ]);
    expect(inventoryOf(world)).toEqual(before);
  });
});

/** The id of the Inventory Item at a cell. */
const idAt = (world: World, column: number, row: number) =>
  inventoryItemAt(world, { column, row })?.item.id ?? -1;

describe("swapping to a Belt with fewer rows", () => {
  it("moves the Potions in rows that no longer exist into the Inventory", () => {
    const world = holding({
      equipment: { belt: "platedBelt" },
      inventory: [at("sash", 0, 0)],
      belt: [
        ["lifePotion", "lifePotion", "manaPotion", "manaPotion"],
        ["lifePotion", "lifePotion", "lifePotion"],
        [],
        [],
      ],
    });

    const events = step(world, [
      { type: "EquipItem", item: idAt(world, 0, 0) },
    ]);

    expect(equipmentOf(world).belt?.type).toBe("sash");
    expect(beltTypesOf(world)).toEqual([
      ["lifePotion", "lifePotion"],
      ["lifePotion", "lifePotion"],
      [],
      [],
    ]);
    expect(carried(world)).toEqual([
      "lifePotion",
      "manaPotion",
      "manaPotion",
      "platedBelt",
    ]);
    expect(types(events)).toContain("BeltChanged");
  });

  it("is refused with No room, nothing moving, when those Potions don't all fit", () => {
    const world = holding({
      equipment: { belt: "heavyBelt" },
      // The Heavy Belt goes back where the Sash was, leaving no room.
      inventory: [
        ...filledBut([
          { column: 0, row: 0 },
          { column: 1, row: 0 },
        ]),
        at("sash", 0, 0),
      ],
      belt: [["lifePotion", "lifePotion", "lifePotion"], [], [], []],
    });
    const before = inventoryOf(world);

    const events = step(world, [
      { type: "EquipItem", item: idAt(world, 0, 0) },
    ]);

    expect(types(events)).toEqual(["NoRoom"]);
    expect(equipmentOf(world).belt?.type).toBe("heavyBelt");
    expect(beltTypesOf(world)[0]).toHaveLength(3);
    expect(inventoryOf(world)).toEqual(before);
  });

  it("moves nothing when the new Belt has more rows", () => {
    const world = holding({
      equipment: { belt: "sash" },
      inventory: [at("platedBelt", 0, 0)],
      belt: [["lifePotion", "lifePotion"], [], [], []],
    });

    const events = step(world, [
      { type: "EquipItem", item: idAt(world, 0, 0) },
    ]);

    expect(beltRows(world)).toBe(4);
    expect(beltTypesOf(world)[0]).toHaveLength(2);
    expect(types(events)).not.toContain("BeltChanged");
  });
});

describe("lifting the Belt out of its slot", () => {
  it("takes it off, moving the Potions in rows that no longer exist into the Inventory", () => {
    const world = holding({
      equipment: { belt: "sash" },
      belt: [["lifePotion", "manaPotion"], [], [], []],
    });

    const events = step(world, [{ type: "LiftItem", from: "belt" }]);

    expect(cursorItemOf(world)?.item.type).toBe("sash");
    expect(beltRows(world)).toBe(1);
    expect(beltTypesOf(world)[0]).toEqual(["lifePotion"]);
    expect(carried(world)).toEqual(["manaPotion"]);
    expect(types(events)).toContain("BeltChanged");
  });

  it("is refused with No room, nothing moving, when those Potions don't all fit", () => {
    const world = holding({
      equipment: { belt: "sash" },
      inventory: filledBut([]),
      belt: [["lifePotion", "manaPotion"], [], [], []],
    });

    const events = step(world, [{ type: "LiftItem", from: "belt" }]);

    expect(types(events)).toEqual(["NoRoom"]);
    expect(cursorItemOf(world)).toBeNull();
    expect(equipmentOf(world).belt?.type).toBe("sash");
    expect(beltTypesOf(world)[0]).toHaveLength(2);
  });
});

describe("putting a held Belt into the Belt slot", () => {
  it("swaps it in, moving the Potions in rows that no longer exist into the Inventory", () => {
    const world = holding({
      equipment: { belt: "heavyBelt" },
      inventory: [at("sash", 0, 0)],
      belt: [["lifePotion", "lifePotion", "manaPotion"], [], [], []],
    });
    step(world, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);

    const events = step(world, [{ type: "PlaceItem", to: "belt" }]);

    expect(equipmentOf(world).belt?.type).toBe("sash");
    expect(cursorItemOf(world)?.item.type).toBe("heavyBelt");
    expect(beltTypesOf(world)[0]).toEqual(["lifePotion", "lifePotion"]);
    expect(carried(world)).toEqual(["manaPotion"]);
    expect(types(events)).toContain("BeltChanged");
  });

  it("is refused with No room, nothing moving, when those Potions don't all fit", () => {
    const world = holding({
      equipment: { belt: "heavyBelt" },
      inventory: [
        ...filledBut([
          { column: 0, row: 0 },
          { column: 1, row: 0 },
        ]),
        at("sash", 0, 0),
      ],
      belt: [["lifePotion", "lifePotion", "manaPotion"], [], [], []],
    });
    step(world, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);

    expect(placement(world, "belt")).toBeNull();
    const events = step(world, [{ type: "PlaceItem", to: "belt" }]);

    expect(types(events)).toEqual(["NoRoom"]);
    expect(equipmentOf(world).belt?.type).toBe("heavyBelt");
    expect(cursorItemOf(world)?.item.type).toBe("sash");
    expect(beltTypesOf(world)[0]).toHaveLength(3);
  });
});

describe("a Potion held from a Belt row that no longer exists", () => {
  it("goes back to the Inventory cell it moved to", () => {
    const world = holding({
      equipment: { belt: "sash" },
      belt: [["lifePotion", "manaPotion"], [], [], []],
    });
    step(world, [{ type: "LiftItem", from: { beltColumn: 0, row: 1 } }]);

    step(world, [{ type: "UnequipItem", slot: "belt" }]);
    step(world, [{ type: "ReturnCursorItem" }]);

    expect(beltTypesOf(world)[0]).toEqual(["lifePotion"]);
    expect(carried(world)).toEqual(["manaPotion", "sash"]);
  });
});
