import { describe, expect, it } from "vitest";
import { emptyBelt } from "../sim/belt";
import {
  type Belongings,
  type EquipmentSlot,
  inventoryOf,
} from "../sim/inventory";
import { overlaps } from "../sim/rect";
import { createWorld, type Progress, step } from "../sim/world";
import {
  inventoryHitAt,
  inventoryOrder,
  inventoryPanelLayout,
  inventoryRightClickOrder,
  itemRect,
  itemTooltip,
  itemTooltipElements,
  itemUnder,
  landingCell,
} from "./inventoryPanel";

/** Screens at native scale, so the sizes worked out by hand hold. */
const WIDE = {
  width: 1280,
  height: 800,
  uiScale: 1,
  worldZoom: 1,
  compact: false,
  rotateNotice: null,
};
const NARROW = {
  width: 800,
  height: 600,
  uiScale: 1,
  worldZoom: 1,
  compact: false,
  rotateNotice: null,
};

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

function world(belongings?: Belongings, progress?: Progress) {
  return createWorld({ areas: { town }, seed: 1, belongings, progress });
}

/** The rows of a Belt Column with no Belt Equipped. */
const ONE_ROW = 1;

describe("the Inventory panel's layout", () => {
  it("sits at the top right, inside the right half of the screen", () => {
    for (const screen of [WIDE, NARROW]) {
      const { panel } = inventoryPanelLayout(screen, ONE_ROW);

      expect(panel.x).toBeGreaterThanOrEqual(screen.width / 2);
      expect(panel.x + panel.w).toBe(screen.width - 16);
      expect(panel.y).toBe(16);
      expect(panel.y + panel.h).toBeLessThan(screen.height);
    }
  });

  it("puts the Equipment slots above the 10×4 grid", () => {
    const { grid, slots, cell } = inventoryPanelLayout(WIDE, ONE_ROW);

    expect(grid.w).toBe(10 * cell);
    expect(grid.h).toBe(4 * cell);
    for (const slot of Object.values(slots)) {
      expect(slot.y + slot.h).toBeLessThan(grid.y);
    }
  });

  it("puts every Belt Column between the Equipment slots and the grid", () => {
    for (const rows of [1, 4]) {
      const { belt, grid, slots, cell } = inventoryPanelLayout(WIDE, rows);

      expect(belt).toHaveLength(4);
      for (const column of belt) {
        expect(column).toHaveLength(rows);
        for (const rect of column) {
          expect(rect.w).toBe(cell);
          expect(rect.h).toBe(cell);
          expect(rect.y + rect.h).toBeLessThan(grid.y);
          for (const slot of Object.values(slots)) {
            expect(rect.y).toBeGreaterThan(slot.y + slot.h);
          }
        }
      }
    }
  });

  it("stacks a Belt Column's rows from the bottom up, its columns side by side", () => {
    const { belt, cell } = inventoryPanelLayout(WIDE, 3);

    expect(belt[0][1].y).toBe(belt[0][0].y - cell);
    expect(belt[0][2].y).toBe(belt[0][0].y - 2 * cell);
    expect(belt[1][0].x).toBe(belt[0][0].x + cell);
    expect(belt[3][0].y).toBe(belt[0][0].y);
  });

  it("grows to fit more rows of Belt Columns, on a narrow screen too", () => {
    const one = inventoryPanelLayout(NARROW, 1);
    const four = inventoryPanelLayout(NARROW, 4);

    // The cells shrink so that the taller panel still stays on the screen.
    expect(four.belt[0]).toHaveLength(4);
    expect(four.grid.y).toBeGreaterThan(four.belt[0][0].y + four.cell);
    expect(four.panel.y + four.panel.h).toBeLessThan(NARROW.height);
  });

  it("shrinks its cells to fit a narrow screen", () => {
    expect(inventoryPanelLayout(WIDE, ONE_ROW).cell).toBe(36);
    expect(inventoryPanelLayout(NARROW, ONE_ROW).cell).toBe(29);
  });

  it("draws an Item over the cells it covers", () => {
    const layout = inventoryPanelLayout(WIDE, ONE_ROW);
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

describe("the Equipment figure", () => {
  const screens = [
    ["wide", WIDE],
    ["narrow", NARROW],
    ["compact", { ...WIDE, width: 800, height: 400, compact: true }],
  ] as const;

  it.each(
    screens,
  )("places the ten slots apart, inside the panel and clear of the grid on a %s screen", (_, screen) => {
    const { slots, panel, grid } = inventoryPanelLayout(screen, ONE_ROW);
    const named = Object.entries(slots);

    expect(named).toHaveLength(10);
    for (const [name, rect] of named) {
      expect(rect.x, name).toBeGreaterThanOrEqual(panel.x);
      expect(rect.x + rect.w, name).toBeLessThanOrEqual(panel.x + panel.w);
      expect(rect.y, name).toBeGreaterThanOrEqual(panel.y);
      expect(rect.y + rect.h, name).toBeLessThanOrEqual(panel.y + panel.h);
      expect(overlaps(rect, grid), name).toBe(false);
    }
    for (const [a, first] of named) {
      for (const [b, second] of named) {
        if (a < b) expect(overlaps(first, second), `${a} ${b}`).toBe(false);
      }
    }
  });

  it.each(
    screens,
  )("arranges them as Diablo 2 does on a %s screen", (_, screen) => {
    const { slots: s } = inventoryPanelLayout(screen, ONE_ROW);
    const mid = (r: { x: number; w: number }) => r.x + r.w / 2;

    // The Helm top centre over the Armour, the Amulet to its right.
    expect(mid(s.helm)).toBeCloseTo(mid(s.armour));
    expect(s.helm.y + s.helm.h).toBeLessThanOrEqual(s.armour.y);
    expect(s.amulet.x).toBeGreaterThanOrEqual(s.helm.x + s.helm.w);
    // The Weapon and Off-hand either side of the Armour.
    expect(s.weapon.x + s.weapon.w).toBeLessThanOrEqual(s.armour.x);
    expect(s.offHand.x).toBeGreaterThanOrEqual(s.armour.x + s.armour.w);
    // Ring 1, Belt and Ring 2 in a row under the Armour.
    const under = s.armour.y + s.armour.h;
    expect(s.ring1.y).toBeGreaterThanOrEqual(under);
    expect(s.belt.y).toBe(s.ring1.y);
    expect(s.ring2.y).toBe(s.ring1.y);
    expect(s.ring1.x).toBeLessThan(s.belt.x);
    expect(s.belt.x).toBeLessThan(s.ring2.x);
    expect(mid(s.belt)).toBeCloseTo(mid(s.armour));
    // Gloves bottom left, Boots bottom right.
    expect(s.gloves.x).toBeLessThan(s.ring1.x);
    expect(s.boots.x).toBeGreaterThan(s.ring2.x);
    expect(s.gloves.y + s.gloves.h).toBeGreaterThan(s.weapon.y + s.weapon.h);
    expect(s.boots.y).toBe(s.gloves.y);
  });
});

describe("what a point on the Inventory panel hits", () => {
  it.each([
    ["wide", WIDE],
    ["narrow", NARROW],
  ])("finds the grid cell under it on a %s screen", (_, screen) => {
    const { grid, cell } = inventoryPanelLayout(screen, ONE_ROW);
    const at = (column: number, row: number) => ({
      x: grid.x + (column + 0.5) * cell,
      y: grid.y + (row + 0.5) * cell,
    });

    expect(inventoryHitAt(screen, at(0, 0), true, false, ONE_ROW)).toEqual({
      inventory: { column: 0, row: 0 },
    });
    expect(inventoryHitAt(screen, at(7, 2), true, false, ONE_ROW)).toEqual({
      inventory: { column: 7, row: 2 },
    });
    expect(inventoryHitAt(screen, at(9, 3), true, false, ONE_ROW)).toEqual({
      inventory: { column: 9, row: 3 },
    });
  });

  it("gives a point on the line between two cells to the right and lower one", () => {
    const { grid, cell } = inventoryPanelLayout(WIDE, ONE_ROW);

    expect(
      inventoryHitAt(
        WIDE,
        { x: grid.x + 2 * cell, y: grid.y + cell },
        true,
        false,
        ONE_ROW,
      ),
    ).toEqual({ inventory: { column: 2, row: 1 } });
  });

  it("keeps the grid's far edges in its last cells", () => {
    const { grid } = inventoryPanelLayout(WIDE, ONE_ROW);

    expect(
      inventoryHitAt(
        WIDE,
        { x: grid.x + grid.w, y: grid.y + grid.h },
        true,
        false,
        ONE_ROW,
      ),
    ).toEqual({ inventory: { column: 9, row: 3 } });
    expect(
      inventoryHitAt(WIDE, { x: grid.x, y: grid.y }, true, false, ONE_ROW),
    ).toEqual({
      inventory: { column: 0, row: 0 },
    });
  });

  it.each([
    ["wide", WIDE],
    ["narrow", NARROW],
  ])("finds each Equipment slot on a %s screen", (_, screen) => {
    const { slots } = inventoryPanelLayout(screen, ONE_ROW);

    for (const [slot, rect] of Object.entries(slots)) {
      const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
      const corner = { x: rect.x + rect.w, y: rect.y + rect.h };
      for (const point of [centre, corner]) {
        expect(inventoryHitAt(screen, point, true, false, ONE_ROW)).toEqual({
          inventory: slot,
        });
      }
    }
  });

  // Worked out by hand from INVENTORY_PANEL, so they don't lean on the
  // layout they test. The slots' area is 7 cells tall and 9 wide, centred
  // over the grid's 10. Wide: 36 px cells, the grid's top-left at (886, 398)
  // and the slots' area at (904, 74). Narrow: the Skill Bar's slots start at
  // y 514, which the panel stops above, so 29 px cells, the grid at
  // (476, 342) and the slots' area at (490.5, 74). One row of Belt Columns
  // sits between them: wide at (994, 344), narrow at (563, 295).
  it.each([
    ["wide", WIDE, { x: 900, y: 416 }, { column: 0, row: 0 }],
    ["wide", WIDE, { x: 1148, y: 475 }, { column: 7, row: 2 }],
    ["narrow", NARROW, { x: 480, y: 345 }, { column: 0, row: 0 }],
    ["narrow", NARROW, { x: 742, y: 434 }, { column: 9, row: 3 }],
  ])("maps a %s screen's point %o to its cell", (_, screen, point, cell) => {
    expect(inventoryHitAt(screen, point, true, false, ONE_ROW)).toEqual({
      inventory: cell,
    });
  });

  it.each([
    ["wide", WIDE, { x: 930, y: 150 }, "weapon"],
    ["wide", WIDE, { x: 1110, y: 290 }, "ring2"],
    ["wide", WIDE, { x: 1050, y: 100 }, "helm"],
    ["wide", WIDE, { x: 950, y: 280 }, "gloves"],
    ["wide", WIDE, { x: 1180, y: 280 }, "boots"],
    ["narrow", NARROW, { x: 670, y: 95 }, "amulet"],
    ["narrow", NARROW, { x: 600, y: 200 }, "armour"],
    ["narrow", NARROW, { x: 700, y: 150 }, "offHand"],
  ] as const)("maps a %s screen's point %o to its slot", (_, screen, point, slot) => {
    expect(inventoryHitAt(screen, point, true, false, ONE_ROW)).toEqual({
      inventory: slot,
    });
  });

  it.each([
    ["wide", WIDE, { x: 1000, y: 360 }, { beltColumn: 0, row: 0 }],
    ["wide", WIDE, { x: 1120, y: 360 }, { beltColumn: 3, row: 0 }],
    ["narrow", NARROW, { x: 630, y: 310 }, { beltColumn: 2, row: 0 }],
  ])("maps a %s screen's point %o to its Belt Column cell", (_, screen, point, spot) => {
    expect(inventoryHitAt(screen, point, true, false, ONE_ROW)).toEqual({
      inventory: spot,
    });
  });

  it("finds each Belt Column cell with more rows, row 0 at the bottom", () => {
    const { belt } = inventoryPanelLayout(WIDE, 3);
    const centre = (rect: { x: number; y: number; w: number; h: number }) => ({
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
    });

    expect(inventoryHitAt(WIDE, centre(belt[1][2]), true, false, 3)).toEqual({
      inventory: { beltColumn: 1, row: 2 },
    });
    expect(inventoryHitAt(WIDE, centre(belt[3][0]), true, false, 3)).toEqual({
      inventory: { beltColumn: 3, row: 0 },
    });
  });

  it("is the panel but nothing on it between the slots and the grid", () => {
    const { grid, panel } = inventoryPanelLayout(WIDE, ONE_ROW);

    expect(
      inventoryHitAt(
        WIDE,
        { x: panel.x + 4, y: grid.y - 4 },
        true,
        false,
        ONE_ROW,
      ),
    ).toEqual({ inventory: null });
  });

  it.each([
    ["wide", WIDE],
    ["narrow", NARROW],
  ])("finds the × above the Equipment slots on a %s screen", (_, screen) => {
    const { closeButton, slots } = inventoryPanelLayout(screen, ONE_ROW);
    const at = {
      x: closeButton.x + closeButton.w / 2,
      y: closeButton.y + closeButton.h / 2,
    };
    const topOfSlots = Math.min(...Object.values(slots).map((slot) => slot.y));

    expect(closeButton.y + closeButton.h).toBeLessThanOrEqual(topOfSlots);
    expect(inventoryHitAt(screen, at, true, false, ONE_ROW)).toEqual({
      button: { type: "close", panel: "inventory" },
    });
    expect(inventoryHitAt(screen, at, false, false, ONE_ROW)).toBeNull();
  });

  it("finds the × while an Item is held, not dropping it", () => {
    const { closeButton } = inventoryPanelLayout(WIDE, ONE_ROW);
    const at = { x: closeButton.x + 1, y: closeButton.y + 1 };

    expect(inventoryHitAt(WIDE, at, true, true, ONE_ROW)).toEqual({
      button: { type: "close", panel: "inventory" },
    });
  });

  it("is nothing outside the panel", () => {
    const { panel } = inventoryPanelLayout(WIDE, ONE_ROW);

    for (const point of [
      { x: panel.x - 1, y: panel.y + 100 },
      { x: panel.x + 100, y: panel.y + panel.h + 1 },
      { x: 100, y: 100 },
    ]) {
      expect(inventoryHitAt(WIDE, point, true, false, ONE_ROW)).toBeNull();
    }
  });

  it("is nothing while the panel is closed", () => {
    const { grid } = inventoryPanelLayout(WIDE, ONE_ROW);

    expect(
      inventoryHitAt(
        WIDE,
        { x: grid.x + 1, y: grid.y + 1 },
        false,
        false,
        ONE_ROW,
      ),
    ).toBe(null);
  });

  it("is a drop outside the panel while an Item is held", () => {
    const { panel } = inventoryPanelLayout(WIDE, ONE_ROW);

    expect(
      inventoryHitAt(WIDE, { x: 100, y: 100 }, true, true, ONE_ROW),
    ).toEqual({
      drop: true,
    });
    expect(
      inventoryHitAt(
        WIDE,
        { x: panel.x + 4, y: panel.y + 4 },
        true,
        true,
        ONE_ROW,
      ),
    ).toEqual({ inventory: null });
  });
});

describe("where a held Item lands", () => {
  const layout = inventoryPanelLayout(WIDE, ONE_ROW);
  const { grid, cell } = layout;
  /** The point `dx`, `dy` cells from the grid's top-left. */
  const point = (dx: number, dy: number) => ({
    x: grid.x + dx * cell,
    y: grid.y + dy * cell,
  });

  it("is the cell under the pointer for a 1×1 Item", () => {
    expect(landingCell(layout, point(3.5, 2.5), "ring")).toEqual({
      column: 3,
      row: 2,
    });
    // On the line between two cells, the right and lower one.
    expect(landingCell(layout, point(3, 2), "ring")).toEqual({
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
  const layout = inventoryPanelLayout(WIDE, ONE_ROW);
  const { grid, cell } = layout;
  const centreOf = (column: number, row: number) => ({
    x: grid.x + (column + 0.5) * cell,
    y: grid.y + (row + 0.5) * cell,
  });
  const onCell = (column: number, row: number) => ({
    inventory: { column, row },
  });
  const belongings: Belongings = {
    inventory: [{ type: "axe", cell: { column: 4, row: 1 } }],
    equipment: {},
    belt: emptyBelt(),
  };

  it("lifts the Item under it with nothing held", () => {
    expect(
      inventoryOrder(world(belongings), WIDE, centreOf(5, 3), onCell(5, 3)),
    ).toEqual({ type: "LiftItem", from: { column: 5, row: 3 } });
    expect(
      inventoryOrder(world(belongings), WIDE, centreOf(0, 0), onCell(0, 0)),
    ).toBeNull();
  });

  it("puts the held Item down centred on the pointer", () => {
    const w = world(belongings);
    step(w, [{ type: "LiftItem", from: { column: 4, row: 1 } }]);
    const centre = { x: grid.x + 2 * cell, y: grid.y + 1.5 * cell };

    expect(inventoryOrder(w, WIDE, centre, onCell(2, 1))).toEqual({
      type: "PlaceItem",
      to: { column: 1, row: 0 },
    });
  });

  it("puts the held Item down on the grid below every row of the Equipped Belt", () => {
    const w = world({
      ...belongings,
      equipment: { belt: { type: "platedBelt" } },
    });
    step(w, [{ type: "LiftItem", from: { column: 4, row: 1 } }]);
    const four = inventoryPanelLayout(WIDE, 4);
    const centre = { x: four.grid.x + 2 * cell, y: four.grid.y + 1.5 * cell };

    expect(inventoryOrder(w, WIDE, centre, onCell(2, 1))).toEqual({
      type: "PlaceItem",
      to: { column: 1, row: 0 },
    });
  });

  it("drops the held Item for a click outside the panel", () => {
    const w = world(belongings);
    step(w, [{ type: "LiftItem", from: { column: 4, row: 1 } }]);

    expect(inventoryOrder(w, WIDE, { x: 10, y: 10 }, { drop: true })).toEqual({
      type: "DropItem",
    });
  });

  it("orders nothing between the cells", () => {
    expect(
      inventoryOrder(
        world(belongings),
        WIDE,
        { x: 0, y: 0 },
        { inventory: null },
      ),
    ).toBeNull();
  });

  const onSlot = (slot: EquipmentSlot) => ({
    inventory: slot,
  });

  it("lifts the Item out of a slot with nothing held, and nothing from an empty one", () => {
    const w = world({
      inventory: [],
      equipment: { weapon: { type: "axe" } },
      belt: emptyBelt(),
    });
    const point = { x: 0, y: 0 };

    expect(inventoryOrder(w, WIDE, point, onSlot("weapon"))).toEqual({
      type: "LiftItem",
      from: "weapon",
    });
    expect(inventoryOrder(w, WIDE, point, onSlot("armour"))).toBeNull();
  });

  const onBelt = (beltColumn: number, row: number) => ({
    inventory: { beltColumn, row },
  });

  it("lifts the Potion out of a Belt Column cell, and nothing from an empty one", () => {
    const w = world({
      inventory: [],
      equipment: {},
      belt: [["lifePotion"], [], [], []],
    });
    const point = { x: 0, y: 0 };

    expect(inventoryOrder(w, WIDE, point, onBelt(0, 0))).toEqual({
      type: "LiftItem",
      from: { beltColumn: 0, row: 0 },
    });
    expect(inventoryOrder(w, WIDE, point, onBelt(1, 0))).toBeNull();
  });

  it("puts the held Item into a clicked Belt Column", () => {
    const w = world({
      inventory: [{ type: "manaPotion", cell: { column: 0, row: 0 } }],
      equipment: {},
      belt: emptyBelt(),
    });
    step(w, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);

    expect(inventoryOrder(w, WIDE, { x: 0, y: 0 }, onBelt(2, 0))).toEqual({
      type: "PlaceItem",
      to: { beltColumn: 2, row: 0 },
    });
  });

  it("puts the held Item into a clicked slot", () => {
    const w = world(belongings);
    step(w, [{ type: "LiftItem", from: { column: 4, row: 1 } }]);

    expect(inventoryOrder(w, WIDE, { x: 0, y: 0 }, onSlot("weapon"))).toEqual({
      type: "PlaceItem",
      to: "weapon",
    });
  });
});

describe("the order a right-click on the Inventory gives", () => {
  const onCell = (column: number, row: number) => ({
    inventory: { column, row },
  });
  const onSlot = (slot: EquipmentSlot) => ({
    inventory: slot,
  });
  const belongings: Belongings = {
    inventory: [{ type: "axe", cell: { column: 4, row: 1 } }],
    equipment: { armour: { type: "chainMail" } },
    belt: emptyBelt(),
  };

  it("equips the Inventory Item under it", () => {
    const w = world(belongings);
    const [axe] = inventoryOf(w);

    expect(inventoryRightClickOrder(w, onCell(5, 2))).toEqual({
      type: "EquipItem",
      item: axe.item.id,
    });
    expect(inventoryRightClickOrder(w, onCell(0, 0))).toBeNull();
  });

  it("drinks the Inventory Potion under it", () => {
    const w = world({
      inventory: [{ type: "lifePotion", cell: { column: 1, row: 2 } }],
      equipment: {},
      belt: emptyBelt(),
    });
    const [potion] = inventoryOf(w);

    expect(inventoryRightClickOrder(w, onCell(1, 2))).toEqual({
      type: "DrinkItem",
      item: potion.item.id,
    });
  });

  it("orders nothing on a Belt Column cell", () => {
    const w = world({
      inventory: [],
      equipment: {},
      belt: [["lifePotion"], [], [], []],
    });

    expect(
      inventoryRightClickOrder(w, { inventory: { beltColumn: 0, row: 0 } }),
    ).toBeNull();
  });

  it("unequips the Item in the slot under it", () => {
    const w = world(belongings);

    expect(inventoryRightClickOrder(w, onSlot("armour"))).toEqual({
      type: "UnequipItem",
      slot: "armour",
    });
    expect(inventoryRightClickOrder(w, onSlot("weapon"))).toBeNull();
  });

  it("orders nothing while an Item is held, or between the cells", () => {
    const w = world(belongings);
    step(w, [{ type: "LiftItem", from: "armour" }]);

    expect(inventoryRightClickOrder(w, onCell(5, 2))).toBeNull();
    expect(
      inventoryRightClickOrder(world(belongings), { inventory: null }),
    ).toBeNull();
    expect(
      inventoryRightClickOrder(world(belongings), { drop: true }),
    ).toBeNull();
  });
});

describe("the Item under a point", () => {
  const belongings: Belongings = {
    inventory: [{ type: "axe", cell: { column: 4, row: 1 } }],
    equipment: { weapon: { type: "shortSword" } },
    belt: emptyBelt(),
  };

  it("is the Inventory Item covering the cell, from any of its cells", () => {
    const w = world(belongings);

    for (const cell of [
      { column: 4, row: 1 },
      { column: 5, row: 3 },
    ]) {
      expect(itemUnder(w, cell)?.type).toBe("axe");
    }
    expect(itemUnder(w, { column: 6, row: 1 })).toBe(null);
  });

  it("is the Item in a slot, or nothing in an empty one", () => {
    const w = world(belongings);

    expect(itemUnder(w, "weapon")?.type).toBe("shortSword");
    expect(itemUnder(w, "armour")).toBeNull();
  });

  it("is the Potion in a Belt Column cell, or nothing in an empty one", () => {
    const w = world({ ...belongings, belt: [["manaPotion"], [], [], []] });

    expect(itemUnder(w, { beltColumn: 0, row: 0 })?.type).toBe("manaPotion");
    expect(itemUnder(w, { beltColumn: 1, row: 0 })).toBeNull();
  });
});

describe("an Item's tooltip", () => {
  it("names a Weapon and its own damage, before the Hero's Strength", () => {
    expect(itemTooltip({ type: "shortSword" })).toEqual([
      "Short Sword",
      "Damage: 17–25",
    ]);
    expect(itemTooltip({ type: "axe" })).toEqual(["Axe", "Damage: 25–40"]);
  });

  it("lists the Smith bonus after the Item's own bonuses", () => {
    expect(
      itemTooltip({
        type: "axe",
        smithBonus: { bonus: "attackRating", amount: 30 },
      }),
    ).toEqual(["Axe", "Damage: 25–40", "Smith: +30 to Attack Rating"]);
  });

  it("names an Armour and its Defense", () => {
    expect(itemTooltip({ type: "chainMail" })).toEqual([
      "Chain Mail",
      "Defense: 40",
    ]);
  });

  it("names a Helm, Gloves, Boots or Shield and its Defense (and Block)", () => {
    expect(itemTooltip({ type: "ironHelm" })).toEqual([
      "Iron Helm",
      "Defense: 16",
    ]);
    expect(itemTooltip({ type: "chainGloves" })).toEqual([
      "Chain Gloves",
      "Defense: 12",
    ]);
    expect(itemTooltip({ type: "leatherBoots" })).toEqual([
      "Leather Boots",
      "Defense: 6",
    ]);
    expect(itemTooltip({ type: "towerShield" })).toEqual([
      "Tower Shield",
      "Defense: 28",
      "Block: 25%",
    ]);
  });

  it("shows a Shield's Block chance and its Block Affixes as +N% Block", () => {
    expect(itemTooltip({ type: "buckler" })).toEqual([
      "Buckler",
      "Defense: 14",
      "Block: 15%",
    ]);
    expect(
      itemTooltip({
        type: "towerShield",
        affixes: [{ kind: "block", grade: 0, value: 4 }],
      }),
    ).toContain("+4% Block");
  });

  it("names a plain Ring or Amulet with no bonuses of its own", () => {
    expect(itemTooltip({ type: "ring" })).toEqual(["Ring"]);
    expect(itemTooltip({ type: "amulet" })).toEqual(["Amulet"]);
  });

  it("says what a Potion gives back, and how fast", () => {
    expect(itemTooltip({ type: "lifePotion" })).toEqual([
      "Life Potion",
      "Gives back 30 Life over 4 seconds",
    ]);
    expect(itemTooltip({ type: "manaPotion" })).toEqual([
      "Mana Potion",
      "Gives back 20 Mana over 4 seconds",
    ]);
    expect(itemTooltip({ type: "rejuvenationPotion" })).toEqual([
      "Rejuvenation Potion",
      "Gives back 35% of Life and Mana at once",
    ]);
  });

  it("gives a Belt's rows", () => {
    expect(itemTooltip({ type: "sash" })).toEqual(["Sash", "Rows: 2"]);
    expect(itemTooltip({ type: "heavyBelt" })).toEqual([
      "Heavy Belt",
      "Rows: 3",
    ]);
    expect(itemTooltip({ type: "platedBelt" })).toEqual([
      "Plated Belt",
      "Rows: 4",
    ]);
  });
});

describe("a Magic Item's tooltip", () => {
  const stout = {
    type: "chainMail" as const,
    affixes: [
      { kind: "defense" as const, grade: 1, value: 15 },
      { kind: "strength" as const, grade: 1, value: 5 },
    ],
  };

  it("is named for its Affixes' grades around its type's name", () => {
    expect(itemTooltip(stout)[0]).toBe("Stout Chain Mail of the Bear");
  });

  it("lists one line per Affix after the type's bonuses, then the Smith bonus last", () => {
    expect(
      itemTooltip({
        ...stout,
        smithBonus: { bonus: "life", amount: 20 },
      }),
    ).toEqual([
      "Stout Chain Mail of the Bear",
      "Defense: 40",
      "+15 to Defense",
      "+5 to Strength",
      "Smith: +20 to Life",
    ]);
  });

  it("shows a Rare Item's Rare name, then its type's name, then its Affix lines", () => {
    expect(
      itemTooltip({
        type: "chainMail",
        rareName: "Gloom Bane",
        affixes: stout.affixes,
      }),
    ).toEqual([
      "Gloom Bane",
      "Chain Mail",
      "Defense: 40",
      "+15 to Defense",
      "+5 to Strength",
    ]);
  });

  it("names the Mana and enhanced percent Affixes", () => {
    expect(
      itemTooltip({
        type: "axe",
        affixes: [
          { kind: "enhancedDamage", grade: 0, value: 12 },
          { kind: "mana", grade: 0, value: 6 },
        ],
      }),
    ).toEqual([
      "Jagged Axe of the Spring",
      "Damage: 25–40",
      "+12% Enhanced Damage",
      "+6 to Mana",
    ]);
    expect(
      itemTooltip({
        type: "chainMail",
        affixes: [{ kind: "enhancedDefense", grade: 1, value: 25 }],
      })[2],
    ).toBe("+25% Enhanced Defense");
  });

  it("names Brutality's flat damage", () => {
    expect(
      itemTooltip({
        type: "axe",
        affixes: [{ kind: "brutality", grade: 0, value: 2 }],
      }),
    ).toEqual(["Brutal Axe", "Damage: 25–40", "+2 to Damage"]);
  });
});

describe("a Resistance Affix's tooltip line", () => {
  const shown = {
    type: "leatherCap" as const,
    rarity: "magic" as const,
    affixes: [
      { kind: "coldResistance" as const, grade: 1, value: 14 },
      { kind: "strength" as const, grade: 0, value: 2 },
    ],
  };

  it("reads as a percentage and is named by its grade", () => {
    expect(itemTooltip(shown)).toEqual([
      "Azurite Leather Cap of the Badger",
      "Defense: 8",
      "+14% Cold Resistance",
      "+2 to Strength",
    ]);
  });

  it("is drawn in its Element's colour, other lines in none", () => {
    expect(itemTooltipElements(shown)).toEqual([null, null, "cold", null]);
    expect(
      itemTooltipElements({
        type: "ring",
        affixes: [{ kind: "allResistances", grade: 0, value: 4 }],
      }),
    ).toEqual([null, null]);
  });
});
