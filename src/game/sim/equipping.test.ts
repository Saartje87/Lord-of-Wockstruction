import { describe, expect, it } from "vitest";
import type { ItemType } from "../tuning/items";
import {
  createWorld,
  cursorItemOf,
  type Gear,
  equipmentOf,
  gearOf,
  inventoryOf,
  type SimEvent,
  step,
  type World,
} from "./world";

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

/** An Item of `type` with its top-left at `column`, `row`. */
const at = (type: ItemType, column: number, row: number) => ({
  type,
  cell: { column, row },
});

/** A World whose Hero carries `inventory` and wears `equipment`. */
function wearing(
  equipment: Gear["equipment"],
  inventory: Gear["inventory"] = [],
): World {
  return createWorld({ areas: { town }, seed: 1, gear: { inventory, equipment } });
}

/** The Items on the grid by type and top-left cell. */
const layout = (world: World) =>
  inventoryOf(world).map(({ item, cell }) => ({ type: item.type, cell }));

/** What each Equipment slot holds, by type. */
const worn = (world: World) =>
  Object.fromEntries(
    Object.entries(equipmentOf(world)).map(([slot, item]) => [
      slot,
      item?.type ?? null,
    ]),
  );

/** The id of the Inventory Item of `type`. */
const idOf = (world: World, type: ItemType) => {
  const placed = inventoryOf(world).find(({ item }) => item.type === type);
  if (!placed) throw new Error(`No ${type} in the Inventory`);
  return placed.item.id;
};

const ofType = <T extends SimEvent["type"]>(events: SimEvent[], type: T) =>
  events.filter(
    (event): event is Extract<SimEvent, { type: T }> => event.type === type,
  );

describe("Putting a held Item into a slot", () => {
  it("equips it into an empty slot of its kind", () => {
    const world = wearing({}, [at("amuletOfVitality", 5, 3)]);
    step(world, [{ type: "LiftItem", from: { column: 5, row: 3 } }]);
    const amulet = cursorItemOf(world)?.item;

    const events = step(world, [{ type: "PlaceItem", to: "amulet" }]);

    expect(worn(world).amulet).toBe("amuletOfVitality");
    expect(cursorItemOf(world)).toBeNull();
    expect(layout(world)).toEqual([]);
    expect(ofType(events, "ItemEquipped")).toEqual([
      { type: "ItemEquipped", item: amulet, slot: "amulet" },
    ]);
  });

  it("is refused by a slot of the wrong kind", () => {
    const world = wearing({}, [at("amuletOfVitality", 5, 3)]);
    step(world, [{ type: "LiftItem", from: { column: 5, row: 3 } }]);
    const held = cursorItemOf(world);

    const events = step(world, [{ type: "PlaceItem", to: "ring1" }]);

    expect(events).toEqual([]);
    expect(worn(world).ring1).toBeNull();
    expect(cursorItemOf(world)).toEqual(held);
  });

  it("swaps what was there onto the cursor, to go back where the held Item came from", () => {
    const world = wearing({ weapon: "shortSword" }, [at("axe", 6, 1)]);
    step(world, [{ type: "LiftItem", from: { column: 6, row: 1 } }]);

    step(world, [{ type: "PlaceItem", to: "weapon" }]);

    expect(worn(world).weapon).toBe("axe");
    expect(cursorItemOf(world)).toMatchObject({
      item: { type: "shortSword" },
      from: { column: 6, row: 1 },
    });
    step(world, [{ type: "ReturnCursorItem" }]);
    expect(layout(world)).toEqual([at("shortSword", 6, 1)]);
  });

  it("puts a Ring into either Ring slot", () => {
    const world = wearing({}, [at("ringOfLife", 0, 0)]);
    step(world, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);

    step(world, [{ type: "PlaceItem", to: "ring2" }]);

    expect(worn(world).ring2).toBe("ringOfLife");
    expect(worn(world).ring1).toBeNull();
  });
});

describe("Lifting an Equipped Item", () => {
  it("takes it out of its slot onto the cursor", () => {
    const world = wearing({ armour: "chainMail" });
    const chainMail = equipmentOf(world).armour;

    const events = step(world, [{ type: "LiftItem", from: "armour" }]);

    expect(worn(world).armour).toBeNull();
    expect(cursorItemOf(world)).toEqual({ item: chainMail, from: "armour" });
    expect(ofType(events, "ItemUnequipped")).toEqual([
      { type: "ItemUnequipped", item: chainMail, slot: "armour" },
    ]);
  });

  it("goes back into its slot when returned, and the Save keeps it there", () => {
    const world = wearing({ armour: "chainMail" });
    step(world, [{ type: "LiftItem", from: "armour" }]);

    expect(gearOf(world).equipment.armour).toBe("chainMail");
    step(world, [{ type: "ReturnCursorItem" }]);

    expect(worn(world).armour).toBe("chainMail");
    expect(cursorItemOf(world)).toBeNull();
  });

  it("swaps with a grid Item, which goes back into the slot if it fits there", () => {
    const world = wearing({ armour: "chainMail" }, [at("leatherArmour", 0, 0)]);
    step(world, [{ type: "LiftItem", from: "armour" }]);

    step(world, [{ type: "PlaceItem", to: { column: 0, row: 0 } }]);

    expect(layout(world)).toEqual([at("chainMail", 0, 0)]);
    expect(cursorItemOf(world)).toMatchObject({
      item: { type: "leatherArmour" },
      from: "armour",
    });
  });

  it("swaps with a grid Item of another kind, which goes to the first free spot", () => {
    const world = wearing({ armour: "chainMail" }, [at("ringOfLife", 3, 0)]);
    step(world, [{ type: "LiftItem", from: "armour" }]);

    step(world, [{ type: "PlaceItem", to: { column: 3, row: 0 } }]);

    expect(layout(world)).toEqual([at("chainMail", 3, 0)]);
    expect(cursorItemOf(world)).toMatchObject({
      item: { type: "ringOfLife" },
      from: { column: 0, row: 0 },
    });
  });

  it("does nothing for an empty slot", () => {
    const world = wearing({});

    expect(step(world, [{ type: "LiftItem", from: "ring1" }])).toEqual([]);
    expect(cursorItemOf(world)).toBeNull();
  });
});

describe("Unequipping an Item (right-click)", () => {
  it("moves it to the first free spot in the Inventory", () => {
    const world = wearing({ weapon: "axe" }, [at("chainMail", 0, 0)]);
    const axe = equipmentOf(world).weapon;

    const events = step(world, [{ type: "UnequipItem", slot: "weapon" }]);

    expect(worn(world).weapon).toBeNull();
    expect(layout(world)).toEqual([at("chainMail", 0, 0), at("axe", 2, 0)]);
    expect(ofType(events, "ItemUnequipped")).toEqual([
      { type: "ItemUnequipped", item: axe, slot: "weapon" },
    ]);
    expect(ofType(events, "InventoryChanged")).toHaveLength(1);
  });

  it("is refused with No room when it fits nowhere", () => {
    const armour = [0, 2, 4, 6, 8].map((column) => at("chainMail", column, 0));
    const world = wearing({ armour: "leatherArmour" }, armour);

    const events = step(world, [{ type: "UnequipItem", slot: "armour" }]);

    expect(worn(world).armour).toBe("leatherArmour");
    expect(layout(world)).toEqual(armour);
    expect(events).toEqual([{ type: "NoRoom" }]);
  });

  it("does nothing for an empty slot", () => {
    const world = wearing({});

    expect(step(world, [{ type: "UnequipItem", slot: "amulet" }])).toEqual([]);
  });
});

describe("Equipping a Ring", () => {
  it("fills the left Ring slot first, then the right one", () => {
    const world = wearing({}, [
      at("ringOfStrength", 0, 0),
      at("ringOfDexterity", 1, 0),
    ]);

    step(world, [{ type: "EquipItem", item: idOf(world, "ringOfStrength") }]);
    step(world, [{ type: "EquipItem", item: idOf(world, "ringOfDexterity") }]);

    expect(worn(world).ring1).toBe("ringOfStrength");
    expect(worn(world).ring2).toBe("ringOfDexterity");
  });

  it("goes into the right Ring slot when only that one is empty", () => {
    const world = wearing({ ring1: "ringOfLife" }, [at("ringOfStrength", 0, 0)]);

    step(world, [{ type: "EquipItem", item: idOf(world, "ringOfStrength") }]);

    expect(worn(world).ring1).toBe("ringOfLife");
    expect(worn(world).ring2).toBe("ringOfStrength");
  });

  it("swaps out the left Ring when both slots are full", () => {
    const world = wearing({ ring1: "ringOfLife", ring2: "ringOfDexterity" }, [
      at("ringOfStrength", 4, 2),
    ]);

    step(world, [{ type: "EquipItem", item: idOf(world, "ringOfStrength") }]);

    expect(worn(world).ring1).toBe("ringOfStrength");
    expect(worn(world).ring2).toBe("ringOfDexterity");
    expect(layout(world)).toEqual([at("ringOfLife", 4, 2)]);
  });
});

describe("Equipping an Inventory Item (right-click)", () => {
  it("puts it into the empty slot of its kind", () => {
    const world = wearing({}, [at("leatherArmour", 3, 1)]);
    const item = idOf(world, "leatherArmour");

    const events = step(world, [{ type: "EquipItem", item }]);

    expect(worn(world).armour).toBe("leatherArmour");
    expect(layout(world)).toEqual([]);
    expect(ofType(events, "ItemEquipped")).toEqual([
      { type: "ItemEquipped", item: { id: item, type: "leatherArmour" }, slot: "armour" },
    ]);
    expect(ofType(events, "InventoryChanged")).toHaveLength(1);
  });

  it("swaps what was there into the space it leaves", () => {
    const world = wearing({ armour: "chainMail" }, [at("leatherArmour", 3, 1)]);
    const chainMail = equipmentOf(world).armour;

    const events = step(world, [
      { type: "EquipItem", item: idOf(world, "leatherArmour") },
    ]);

    expect(worn(world).armour).toBe("leatherArmour");
    expect(layout(world)).toEqual([at("chainMail", 3, 1)]);
    expect(ofType(events, "ItemUnequipped")).toEqual([
      { type: "ItemUnequipped", item: chainMail, slot: "armour" },
    ]);
  });

  it("puts what was there in the first free spot when it doesn't fit the space left", () => {
    // The Axe is two columns wide, and the Ring is in the way of the second.
    const world = wearing({ weapon: "axe" }, [
      at("shortSword", 0, 0),
      at("ringOfLife", 1, 1),
    ]);

    step(world, [{ type: "EquipItem", item: idOf(world, "shortSword") }]);

    expect(worn(world).weapon).toBe("shortSword");
    expect(layout(world)).toEqual([at("ringOfLife", 1, 1), at("axe", 2, 0)]);
  });

  it("is refused when what was there fits nowhere", () => {
    const rings = [];
    for (let column = 1; column < 10; column++) {
      for (let row = 0; row < 4; row++) rings.push(at("ringOfLife", column, row));
    }
    const world = wearing({ weapon: "axe" }, [at("shortSword", 0, 0), ...rings]);
    const before = layout(world);

    const events = step(world, [
      { type: "EquipItem", item: idOf(world, "shortSword") },
    ]);

    expect(worn(world).weapon).toBe("axe");
    expect(layout(world)).toEqual(before);
    expect(events).toEqual([]);
  });
});
