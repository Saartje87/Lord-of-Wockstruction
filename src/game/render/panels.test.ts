import { describe, expect, it } from "vitest";
import { NO_FULLSCREEN } from "../fullscreen";
import { EQUIPMENT_SLOTS } from "../sim/inventory";
import { overlaps, type Rect } from "../sim/rect";
import { emptySkillBar } from "../sim/skillBar";
import { ATTRIBUTES, createWorld, FRESH_PROGRESS, SKILLS } from "../sim/world";
import { ITEM_TYPES, inventoryTuning, itemOf } from "../tuning/items";
import { type Viewport, viewportOf } from "../viewport";
import { heroPanelHitAt, heroPanelLayout } from "./heroPanel";
import {
  heldItemRect,
  inventoryHitAt,
  inventoryPanelLayout,
  itemRect,
  landingCell,
} from "./inventoryPanel";
import { menuChoiceAt, pauseMenuLayout } from "./pauseMenu";
import { skillTreeHitAt, skillTreePanelLayout } from "./skillTreePanel";

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

/**
 * A Level 3 Hero with Attribute Points and a Skill Point unspent and the
 * Golem learned, so every + and the Skill's rows are there to hit.
 */
const world = createWorld({
  areas: { town },
  seed: 1,
  progress: {
    ...FRESH_PROGRESS,
    level: 3,
    experience: 1_500,
    attributePoints: 10,
    skillPoints: 1,
    skillLevels: { golem: 1 },
    skillBar: emptySkillBar(),
  },
});

/** A point pending on each Attribute, so each − and Accept show. */
const pending = { strength: 1, dexterity: 1, vitality: 1, energy: 1 };

/** The screens the panels are checked on: desktops and a tablet. */
const SCREENS = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 1180, height: 820 },
];

/** The rows of Belt Columns a Belt can give, from none Equipped up. */
const BELT_ROWS = [1, 2, 3, 4];

function centre(rect: Rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function expectOnScreen(viewport: Viewport, rect: Rect, name: string) {
  expect(rect.x, name).toBeGreaterThanOrEqual(0);
  expect(rect.y, name).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.w, name).toBeLessThanOrEqual(viewport.width);
  expect(rect.y + rect.h, name).toBeLessThanOrEqual(viewport.height);
}

describe("the panels at the UI Scale", () => {
  it.each(
    SCREENS,
  )("draws the panels and their × at the UI Scale on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const { uiScale } = viewport;
    const hero = heroPanelLayout(viewport);
    const skillTree = skillTreePanelLayout(viewport);
    const inventory = inventoryPanelLayout(viewport, 1);

    // At native scale: 300×524 Hero panel and 300 px Skill Tree panel,
    // 16 px from the corners, with 22 px × buttons and 22 px + buttons.
    expect(hero.panel.x).toBeCloseTo(16 * uiScale);
    expect(hero.panel.y).toBeCloseTo(16 * uiScale);
    expect(hero.panel.w).toBeCloseTo(300 * uiScale);
    expect(hero.panel.h).toBeCloseTo(524 * uiScale);
    expect(hero.closeButton.w).toBeCloseTo(22 * uiScale);
    expect(hero.raise.strength.w).toBeCloseTo(22 * uiScale);
    expect(skillTree.panel.w).toBeCloseTo(300 * uiScale);
    expect(skillTree.closeButton.w).toBeCloseTo(22 * uiScale);
    expect(skillTree.raise.golem.w).toBeCloseTo(22 * uiScale);
    expect(skillTree.panel.x + skillTree.panel.w).toBeCloseTo(
      size.width - 16 * uiScale,
    );
    expect(inventory.closeButton.w).toBeCloseTo(22 * uiScale);
    expect(inventory.panel.y).toBeCloseTo(16 * uiScale);
    // Room for the 36 px cells, scaled, in the screen's right half.
    expect(inventory.cell).toBe(Math.floor(36 * uiScale));
  });

  it.each(
    SCREENS,
  )("fits the open panels inside $width×$height without overlapping", (size) => {
    const viewport = viewportOf(size);
    const hero = heroPanelLayout(viewport);
    const skillTree = skillTreePanelLayout(viewport).panel;

    expectOnScreen(viewport, hero.panel, "Hero panel");
    expectOnScreen(viewport, skillTree, "Skill Tree panel");
    expect(overlaps(hero.panel, skillTree)).toBe(false);
    // The Level Up button stays clear of the open Hero panel.
    expect(overlaps(hero.panel, hero.levelUp)).toBe(false);
    for (const rows of BELT_ROWS) {
      const inventory = inventoryPanelLayout(viewport, rows).panel;
      expectOnScreen(viewport, inventory, `Inventory panel, ${rows} rows`);
      expect(overlaps(hero.panel, inventory)).toBe(false);
    }
  });

  it.each(
    SCREENS,
  )("hits the Hero panel's buttons at their centres on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const layout = heroPanelLayout(viewport);
    const at = (rect: Rect) =>
      heroPanelHitAt(viewport, centre(rect), world, true, pending);

    for (const attribute of ATTRIBUTES) {
      expect(at(layout.raise[attribute])).toEqual({
        button: { type: "raise", attribute },
      });
      expect(at(layout.lower[attribute])).toEqual({
        button: { type: "lower", attribute },
      });
    }
    expect(at(layout.accept)).toEqual({ button: { type: "accept" } });
    expect(at(layout.closeButton)).toEqual({
      button: { type: "close", panel: "hero" },
    });
  });

  it.each(
    SCREENS,
  )("hits the Skill Tree's Skills at their centres on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const layout = skillTreePanelLayout(viewport);
    const at = (rect: Rect) =>
      skillTreeHitAt(viewport, centre(rect), world, true);

    for (const skill of SKILLS) {
      expect(at(layout.raise[skill])).toEqual({
        button: { type: "learn", skill },
      });
      // The rows left of the +.
      const rows = layout.skills[skill];
      const name = { ...rows, w: layout.raise[skill].x - rows.x };
      expect(at(name)).toEqual({ button: { type: "pickUpSkill", skill } });
    }
    expect(at(layout.closeButton)).toEqual({
      button: { type: "close", panel: "skillTree" },
    });
  });

  it.each(
    SCREENS,
  )("hits the Inventory panel's cells, slots and Belt Columns at their centres on $width×$height", (size) => {
    const viewport = viewportOf(size);
    for (const rows of BELT_ROWS) {
      const layout = inventoryPanelLayout(viewport, rows);
      const at = (point: { x: number; y: number }) =>
        inventoryHitAt(viewport, point, true, false, rows);
      const { grid, cell } = layout;

      for (let column = 0; column < inventoryTuning.columns; column++) {
        for (let row = 0; row < inventoryTuning.rows; row++) {
          const point = {
            x: grid.x + (column + 0.5) * cell,
            y: grid.y + (row + 0.5) * cell,
          };
          expect(at(point)).toEqual({ inventory: { column, row } });
        }
      }
      for (const slot of EQUIPMENT_SLOTS) {
        expect(at(centre(layout.slots[slot]))).toEqual({ inventory: slot });
      }
      layout.belt.forEach((cells, beltColumn) => {
        cells.forEach((rect, row) => {
          expect(at(centre(rect))).toEqual({
            inventory: { beltColumn, row },
          });
        });
      });
      expect(at(centre(layout.closeButton))).toEqual({
        button: { type: "close", panel: "inventory" },
      });
    }
  });

  it.each(
    SCREENS,
  )("draws the pause menu at the UI Scale and hits its buttons on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const { uiScale } = viewport;
    for (const confirming of [false, true]) {
      const { panel, buttons } = pauseMenuLayout(
        viewport,
        confirming,
        "mouseAndKeyboard",
        NO_FULLSCREEN,
      );

      // At native scale: a 460×290 panel with 160×32 buttons.
      expect(panel.w).toBeCloseTo(460 * uiScale);
      expect(panel.h).toBeCloseTo(290 * uiScale);
      expectOnScreen(viewport, panel, "pause menu");
      for (const { choice, rect } of buttons) {
        expect(rect.w).toBeCloseTo(160 * uiScale);
        expect(rect.h).toBeCloseTo(32 * uiScale);
        expect(
          menuChoiceAt(
            viewport,
            centre(rect),
            confirming,
            "mouseAndKeyboard",
            NO_FULLSCREEN,
          ),
        ).toBe(choice);
      }
    }
  });

  it.each(
    SCREENS,
  )("draws a Held Item at the UI Scale, over the cells it lands on, on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const layout = inventoryPanelLayout(viewport, 1);
    const { grid, cell } = layout;

    for (const type of ITEM_TYPES) {
      const { columns, rows } = itemOf(type).size;
      // Held over the middle of the grid, off the cell lines.
      const pointer = {
        x: grid.x + grid.w / 2 + cell * 0.3,
        y: grid.y + grid.h / 2 - cell * 0.2,
      };
      const held = heldItemRect(layout, pointer, type);
      const lands = itemRect(layout, landingCell(layout, pointer, type), type);

      expect(held.w).toBe(columns * cell);
      expect(held.h).toBe(rows * cell);
      expect(centre(held)).toEqual(pointer);
      // On the cells nearest where it's drawn, less than half a cell off.
      expect(Math.abs(lands.x - held.x)).toBeLessThanOrEqual(cell / 2);
      expect(Math.abs(lands.y - held.y)).toBeLessThanOrEqual(cell / 2);
    }
  });
});
