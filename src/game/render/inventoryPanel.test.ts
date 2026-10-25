import { describe, expect, it } from "vitest";
import { createWorld, type Gear, type Progress } from "../sim/world";
import {
  inventoryHitAt,
  inventoryPanelLayout,
  itemRect,
  itemTooltip,
  itemUnder,
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
      "Defense: 35",
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
