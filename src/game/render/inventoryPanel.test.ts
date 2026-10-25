import { describe, expect, it } from "vitest";
import {
  createWorld,
  type EquipmentSlot,
  type Gear,
  inventoryOf,
  type Progress,
  step,
} from "../sim/world";
import {
  inventoryHitAt,
  inventoryOrder,
  inventoryPanelLayout,
  inventoryRightClickOrder,
  itemRect,
  itemTooltip,
  itemUnder,
  landingCell,
} from "./inventoryPanel";

const WIDE = { width: 1280, height: 800 };
const NARROW = { width: 800, height: 600 };

/** A Town of one tile with the Hero's `start` on it. */
const town = {
  orientation: "orthogonal",
  width: 1,
  height: 1,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "floor", width: 1, height: 1, data: [1] },
    {
      type: "objectgroup",
      name: "objects",
      objects: [{ name: "start", type: "entry", point: true, x: 16, y: 16 }],
    },
  ],
};

function world(gear?: Gear, progress?: Progress) {
  return createWorld({ areas: { town }, seed: 1, gear, progress });
}

describe("the Inventory panel's layout", () => {
  it("sits at the top right, inside the right half of the screen", () => {
    for (const screen of [WIDE, NARROW]) {
      const { panel } = inventoryPanelLayout(screen);

      expect(panel.x).toBeGreaterThanOrEqual(screen.width / 2);
      expect(panel.x + panel.w).toBe(screen.width - 16);
      expect(panel.y).toBe(16);
      expect(panel.y + panel.h).toBeLessThan(screen.height);
    }
  });

  it("puts the Equipment slots above the 10×4 grid", () => {
    const { grid, slots, cell } = inventoryPanelLayout(WIDE);

    expect(grid.w).toBe(10 * cell);
    expect(grid.h).toBe(4 * cell);
    for (const slot of Object.values(slots)) {
      expect(slot.y + slot.h).toBeLessThan(grid.y);
    }
  });

  it("shrinks its cells to fit a narrow screen", () => {
    expect(inventoryPanelLayout(WIDE).cell).toBe(36);
    expect(inventoryPanelLayout(NARROW).cell).toBe(34);
  });

  it("draws an Item over the cells it covers", () => {
    const layout = inventoryPanelLayout(WIDE);
    const { grid, cell } = layout;

    // The Axe is 2×3.
    expect(itemRect(layout, { column: 3, row: 1 }, "axe")).toEqual({
      x: grid.x + 3 * cell,
      y: grid.y + cell,
      w: 2 * cell,
      h: 3 * cell,
    });
  });
});

describe("what a point on the Inventory panel hits", () => {
  it.each([
    ["wide", WIDE],
    ["narrow", NARROW],
  ])("finds the grid cell under it on a %s screen", (_, screen) => {
    const { grid, cell } = inventoryPanelLayout(screen);
    const at = (column: number, row: number) => ({
      x: grid.x + (column + 0.5) * cell,
      y: grid.y + (row + 0.5) * cell,
    });

    expect(inventoryHitAt(screen, at(0, 0), true)).toEqual({
      inventory: { type: "cell", cell: { column: 0, row: 0 } },
    });
    expect(inventoryHitAt(screen, at(7, 2), true)).toEqual({
      inventory: { type: "cell", cell: { column: 7, row: 2 } },
    });
    expect(inventoryHitAt(screen, at(9, 3), true)).toEqual({
      inventory: { type: "cell", cell: { column: 9, row: 3 } },
    });
  });

  it("gives a point on the line between two cells to the right and lower one", () => {
    const { grid, cell } = inventoryPanelLayout(WIDE);

    expect(
      inventoryHitAt(WIDE, { x: grid.x + 2 * cell, y: grid.y + cell }, true),
    ).toEqual({ inventory: { type: "cell", cell: { column: 2, row: 1 } } });
  });

  it("keeps the grid's far edges in its last cells", () => {
    const { grid } = inventoryPanelLayout(WIDE);

    expect(
      inventoryHitAt(WIDE, { x: grid.x + grid.w, y: grid.y + grid.h }, true),
    ).toEqual({ inventory: { type: "cell", cell: { column: 9, row: 3 } } });
    expect(inventoryHitAt(WIDE, { x: grid.x, y: grid.y }, true)).toEqual({
      inventory: { type: "cell", cell: { column: 0, row: 0 } },
    });
  });

  it.each([
    ["wide", WIDE],
    ["narrow", NARROW],
  ])("finds each Equipment slot on a %s screen", (_, screen) => {
    const { slots } = inventoryPanelLayout(screen);

    for (const [slot, rect] of Object.entries(slots)) {
      const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
      const corner = { x: rect.x + rect.w, y: rect.y + rect.h };
      for (const point of [centre, corner]) {
        expect(inventoryHitAt(screen, point, true)).toEqual({
          inventory: { type: "slot", slot },
        });
      }
    }
  });

  // Worked out by hand from INVENTORY_PANEL, so they don't lean on the
  // layout they test. Wide: 36 px cells, the grid's top-left at (886, 272)
  // and the slots' area at (886, 74). Narrow: 34 px cells, the grid at
  // (426, 262) and the slots' area at (426, 74).
  it.each([
    ["wide", WIDE, { x: 900, y: 290 }, { column: 0, row: 0 }],
    ["wide", WIDE, { x: 1143, y: 349 }, { column: 7, row: 2 }],
    ["narrow", NARROW, { x: 430, y: 265 }, { column: 0, row: 0 }],
    ["narrow", NARROW, { x: 750, y: 380 }, { column: 9, row: 3 }],
  ])("maps a %s screen's point %o to its cell", (_, screen, point, cell) => {
    expect(inventoryHitAt(screen, point, true)).toEqual({
      inventory: { type: "cell", cell },
    });
  });

  it.each([
    ["wide", WIDE, { x: 930, y: 150 }, "weapon"],
    ["wide", WIDE, { x: 1110, y: 230 }, "ring2"],
    ["narrow", NARROW, { x: 680, y: 108 }, "amulet"],
    ["narrow", NARROW, { x: 590, y: 150 }, "armour"],
  ] as const)("maps a %s screen's point %o to its slot", (_, screen, point, slot) => {
    expect(inventoryHitAt(screen, point, true)).toEqual({
      inventory: { type: "slot", slot },
    });
  });

  it("is the panel but nothing on it between the slots and the grid", () => {
    const { grid, panel } = inventoryPanelLayout(WIDE);

    expect(
      inventoryHitAt(WIDE, { x: panel.x + 4, y: grid.y - 4 }, true),
    ).toEqual({ inventory: null });
  });

  it("is nothing outside the panel", () => {
    const { panel } = inventoryPanelLayout(WIDE);

    for (const point of [
      { x: panel.x - 1, y: panel.y + 100 },
      { x: panel.x + 100, y: panel.y + panel.h + 1 },
      { x: 100, y: 100 },
    ]) {
      expect(inventoryHitAt(WIDE, point, true)).toBeNull();
    }
  });

  it("is nothing while the panel is closed", () => {
    const { grid } = inventoryPanelLayout(WIDE);

    expect(inventoryHitAt(WIDE, { x: grid.x + 1, y: grid.y + 1 }, false)).toBe(
      null,
    );
  });

  it("is a drop outside the panel while an Item is held", () => {
    const { panel } = inventoryPanelLayout(WIDE);

    expect(inventoryHitAt(WIDE, { x: 100, y: 100 }, true, true)).toEqual({
      drop: true,
    });
    expect(
      inventoryHitAt(WIDE, { x: panel.x + 4, y: panel.y + 4 }, true, true),
    ).toEqual({ inventory: null });
  });
});

describe("where a held Item lands", () => {
  const layout = inventoryPanelLayout(WIDE);
  const { grid, cell } = layout;
  /** The point `dx`, `dy` cells from the grid's top-left. */
  const point = (dx: number, dy: number) => ({
    x: grid.x + dx * cell,
    y: grid.y + dy * cell,
  });

  it("is the cell under the pointer for a 1×1 Item", () => {
    expect(landingCell(layout, point(3.5, 2.5), "ringOfLife")).toEqual({
      column: 3,
      row: 2,
    });
    // On the line between two cells, the right and lower one.
    expect(landingCell(layout, point(3, 2), "ringOfLife")).toEqual({
      column: 3,
      row: 2,
    });
  });

  it("centres a sized Item on the pointer", () => {
    // The Axe is 2×3: centred on (5, 2.5), it covers columns 4–5, rows 1–3.
    expect(landingCell(layout, point(5, 2.5), "axe")).toEqual({
      column: 4,
      row: 1,
    });
    expect(landingCell(layout, point(5.4, 2.9), "axe")).toEqual({
      column: 4,
      row: 1,
    });
  });

  it("can hang off the grid, near its edges", () => {
    expect(landingCell(layout, point(0.5, 0.5), "axe")).toEqual({
      column: 0,
      row: -1,
    });
  });
});

describe("the order a click on the Inventory gives", () => {
  const layout = inventoryPanelLayout(WIDE);
  const { grid, cell } = layout;
  const centreOf = (column: number, row: number) => ({
    x: grid.x + (column + 0.5) * cell,
    y: grid.y + (row + 0.5) * cell,
  });
  const onCell = (column: number, row: number) => ({
    inventory: { type: "cell" as const, cell: { column, row } },
  });
  const gear: Gear = {
    inventory: [{ type: "axe", cell: { column: 4, row: 1 } }],
    equipment: {},
  };

  it("lifts the Item under it with nothing held", () => {
    expect(
      inventoryOrder(world(gear), WIDE, centreOf(5, 3), onCell(5, 3)),
    ).toEqual({ type: "LiftItem", from: { column: 5, row: 3 } });
    expect(
      inventoryOrder(world(gear), WIDE, centreOf(0, 0), onCell(0, 0)),
    ).toBeNull();
  });

  it("puts the held Item down centred on the pointer", () => {
    const w = world(gear);
    step(w, [{ type: "LiftItem", from: { column: 4, row: 1 } }]);
    const centre = { x: grid.x + 2 * cell, y: grid.y + 1.5 * cell };

    expect(inventoryOrder(w, WIDE, centre, onCell(2, 1))).toEqual({
      type: "PlaceItem",
      to: { column: 1, row: 0 },
    });
  });

  it("drops the held Item for a click outside the panel", () => {
    const w = world(gear);
    step(w, [{ type: "LiftItem", from: { column: 4, row: 1 } }]);

    expect(inventoryOrder(w, WIDE, { x: 10, y: 10 }, { drop: true })).toEqual({
      type: "DropItem",
    });
  });

  it("orders nothing between the cells", () => {
    expect(
      inventoryOrder(world(gear), WIDE, { x: 0, y: 0 }, { inventory: null }),
    ).toBeNull();
  });

  const onSlot = (slot: EquipmentSlot) => ({
    inventory: { type: "slot" as const, slot },
  });

  it("lifts the Item out of a slot with nothing held, and nothing from an empty one", () => {
    const w = world({ inventory: [], equipment: { weapon: "axe" } });
    const point = { x: 0, y: 0 };

    expect(inventoryOrder(w, WIDE, point, onSlot("weapon"))).toEqual({
      type: "LiftItem",
      from: "weapon",
    });
    expect(inventoryOrder(w, WIDE, point, onSlot("armour"))).toBeNull();
  });

  it("puts the held Item into a clicked slot", () => {
    const w = world(gear);
    step(w, [{ type: "LiftItem", from: { column: 4, row: 1 } }]);

    expect(inventoryOrder(w, WIDE, { x: 0, y: 0 }, onSlot("weapon"))).toEqual({
      type: "PlaceItem",
      to: "weapon",
    });
  });
});

describe("the order a right-click on the Inventory gives", () => {
  const onCell = (column: number, row: number) => ({
    inventory: { type: "cell" as const, cell: { column, row } },
  });
  const onSlot = (slot: EquipmentSlot) => ({
    inventory: { type: "slot" as const, slot },
  });
  const gear: Gear = {
    inventory: [{ type: "axe", cell: { column: 4, row: 1 } }],
    equipment: { armour: "chainMail" },
  };

  it("equips the Inventory Item under it", () => {
    const w = world(gear);
    const [axe] = inventoryOf(w);

    expect(inventoryRightClickOrder(w, onCell(5, 2))).toEqual({
      type: "EquipItem",
      item: axe.item.id,
    });
    expect(inventoryRightClickOrder(w, onCell(0, 0))).toBeNull();
  });

  it("unequips the Item in the slot under it", () => {
    const w = world(gear);

    expect(inventoryRightClickOrder(w, onSlot("armour"))).toEqual({
      type: "UnequipItem",
      slot: "armour",
    });
    expect(inventoryRightClickOrder(w, onSlot("weapon"))).toBeNull();
  });

  it("orders nothing while an Item is held, or between the cells", () => {
    const w = world(gear);
    step(w, [{ type: "LiftItem", from: "armour" }]);

    expect(inventoryRightClickOrder(w, onCell(5, 2))).toBeNull();
    expect(
      inventoryRightClickOrder(world(gear), { inventory: null }),
    ).toBeNull();
    expect(inventoryRightClickOrder(world(gear), { drop: true })).toBeNull();
  });
});

describe("the Item under a point", () => {
  const gear: Gear = {
    inventory: [{ type: "axe", cell: { column: 4, row: 1 } }],
    equipment: { weapon: "shortSword" },
  };

  it("is the Inventory Item covering the cell, from any of its cells", () => {
    const w = world(gear);

    for (const cell of [
      { column: 4, row: 1 },
      { column: 5, row: 3 },
    ]) {
      expect(itemUnder(w, { type: "cell", cell })?.type).toBe("axe");
    }
    expect(itemUnder(w, { type: "cell", cell: { column: 6, row: 1 } })).toBe(
      null,
    );
  });

  it("is the Item in a slot, or nothing in an empty one", () => {
    const w = world(gear);

    expect(itemUnder(w, { type: "slot", slot: "weapon" })?.type).toBe(
      "shortSword",
    );
    expect(itemUnder(w, { type: "slot", slot: "armour" })).toBeNull();
  });
});

describe("an Item's tooltip", () => {
  it("names a Weapon and the damage it deals the Hero", () => {
    const w = world();

    expect(itemTooltip(w, "shortSword")).toEqual([
      "Short Sword",
      "Damage: 20–30",
    ]);
  });

  it("names an Armour and its Defense", () => {
    expect(itemTooltip(world(), "chainMail")).toEqual([
      "Chain Mail",
      "Defense: 40",
    ]);
  });

  it("lists a Ring's or Amulet's bonuses", () => {
    expect(itemTooltip(world(), "ringOfStrength")).toEqual([
      "Ring of Strength",
      "+5 to Strength",
    ]);
    expect(itemTooltip(world(), "ringOfLife")).toEqual([
      "Ring of Life",
      "+10 to Life",
    ]);
  });
});
