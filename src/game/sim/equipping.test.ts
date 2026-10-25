import { describe, expect, it } from "vitest";
import type { ItemType } from "../tuning/items";
import {
  createWorld,
  type Gear,
  equipmentOf,
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
