import { describe, expect, it } from "vitest";
import { createMenus } from "../menus";
import { beltRows, emptyBelt } from "../sim/belt";
import { overlaps, type Rect } from "../sim/rect";
import { createWorld, step } from "../sim/world";
import type { ItemType } from "../tuning/items";
import { viewportOf } from "../viewport";
import { cursorHitAt } from "./cursorHit";
import { inventoryPanelLayout } from "./inventoryPanel";
import { panelButtonsLayout } from "./panelButtons";
import { skillBarLayout } from "./skillBar";

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

/** A Hero with `belt` Equipped, whose Belt rows make the Inventory panel tall. */
function world(belt: ItemType) {
  return createWorld({
    areas: { town },
    seed: 1,
    belongings: {
      inventory: [{ type: "axe", cell: { column: 0, row: 0 } }],
      equipment: { belt },
      belt: emptyBelt(),
    },
  });
}

/** The middle of where `a` and `b` overlap. */
function overlapCentre(a: Rect, b: Rect) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

/**
 * A short screen held at native scale, where the Inventory panel reaches
 * down over the HUD. At the UI Scale they keep clear of each other on the
 * screens the HUD is checked on, but the panel must still win where they
 * meet.
 */
const SMALL = { width: 1024, height: 640, uiScale: 1, worldZoom: 1 };
const inventoryOpen = { ...createMenus(), inventoryOpen: true };

describe("a press where the open Inventory panel covers the HUD", () => {
  it.each([
    "heavyBelt",
    "platedBelt",
  ] as const)("goes to the panel over the Panel buttons and Skill Bar slots it covers at 1024 px, with a %s", (belt) => {
    const w = world(belt);
    const { panel } = inventoryPanelLayout(SMALL, beltRows(w));
    const hud = [
      ...Object.values(panelButtonsLayout(SMALL).buttons),
      ...Object.values(skillBarLayout(SMALL).slots),
    ];
    const covered = hud.filter((rect) => overlaps(rect, panel));
    expect(covered.length).toBeGreaterThan(0);

    for (const rect of covered) {
      const hit = cursorHitAt(
        SMALL,
        overlapCentre(rect, panel),
        w,
        inventoryOpen,
      );
      expect(hit).toHaveProperty("inventory");
    }
  });

  it("goes to the panel there while an Item is held too", () => {
    const w = world("platedBelt");
    step(w, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);
    const { panel } = inventoryPanelLayout(SMALL, beltRows(w));
    const { inventory } = panelButtonsLayout(SMALL).buttons;

    const hit = cursorHitAt(
      SMALL,
      overlapCentre(inventory, panel),
      w,
      inventoryOpen,
    );
    expect(hit).toHaveProperty("inventory");
  });

  it("finds a Panel button the panel leaves clear at 1280 px, rather than a drop", () => {
    const screen = viewportOf({ width: 1280, height: 720 });
    const w = world("platedBelt");
    step(w, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);
    const { panel } = inventoryPanelLayout(screen, beltRows(w));
    const { inventory } = panelButtonsLayout(screen).buttons;
    expect(overlaps(inventory, panel)).toBe(false);

    const centre = {
      x: inventory.x + inventory.w / 2,
      y: inventory.y + inventory.h / 2,
    };
    expect(cursorHitAt(screen, centre, w, inventoryOpen)).toEqual({
      button: { type: "panelButton", panel: "inventory" },
    });
  });
});
