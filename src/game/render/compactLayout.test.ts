import { describe, expect, it } from "vitest";
import { createMenus, PANELS, type Panel } from "../menus";
import { EQUIPMENT_SLOTS } from "../sim/inventory";
import { overlaps, type Rect } from "../sim/rect";
import { emptySkillBar, SKILL_BAR_SLOTS } from "../sim/skillBar";
import { ATTRIBUTES, createWorld, FRESH_PROGRESS, SKILLS } from "../sim/world";
import { heroTuning } from "../tuning/hero";
import { inventoryTuning } from "../tuning/items";
import { BRANCHES, type Skill } from "../tuning/skills";
import { type Viewport, viewportOf } from "../viewport";
import { beltStripLayout } from "./beltStrip";
import { cursorHitAt } from "./cursorHit";
import {
  heroPanelHitAt,
  heroPanelLayout,
  heroPanelRow,
  heroSheet,
  PANEL_ROWS,
} from "./heroPanel";
import { inventoryHitAt, inventoryPanelLayout } from "./inventoryPanel";
import { panelButtonsLayout } from "./panelButtons";
import { skillBarLayout } from "./skillBar";
import {
  fullRooms,
  SKILL_TREE_PANEL,
  skillTreeBranchRow,
  skillTreeHitAt,
  skillTreePanelLayout,
  skillTreePanelRect,
  skillTreeSkillRow,
} from "./skillTreePanel";

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

/** Enough Levels for each Skill at Skill Level 1 and a Skill Point over. */
const level = SKILLS.length + 2;

/**
 * A Hero with Attribute Points and a Skill Point unspent and every
 * Skill learned, so every +, the Level Up button and the Skills' rows are
 * there to hit.
 */
const world = createWorld({
  areas: { town },
  seed: 1,
  progress: {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    attributePoints: 5 * (level - 1),
    skillPoints: 1,
    skillLevels: Object.fromEntries(
      SKILLS.map((skill) => [skill, 1]),
    ) as Record<Skill, number>,
    skillBar: emptySkillBar(),
  },
});

/** A point pending on each Attribute, so each − and Accept show. */
const pending = { strength: 1, dexterity: 1, vitality: 1, energy: 1 };

/** Phones held sideways, which take the Compact Layout. */
const PHONES = [
  { width: 640, height: 320 },
  { width: 640, height: 360 },
  { width: 844, height: 390 },
  { width: 915, height: 330 },
];

/** The rows of Belt Columns a Belt can give, from none Equipped up. */
const BELT_ROWS = [1, 2, 3, 4];

function centre(rect: Rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function expectInside(rect: Rect, outer: Rect, name: string) {
  expect(rect.x, name).toBeGreaterThanOrEqual(outer.x);
  expect(rect.y, name).toBeGreaterThanOrEqual(outer.y);
  expect(rect.x + rect.w, name).toBeLessThanOrEqual(outer.x + outer.w);
  expect(rect.y + rect.h, name).toBeLessThanOrEqual(outer.y + outer.h);
}

function expectApart(parts: [string, Rect][]) {
  for (const [i, [name, rect]] of parts.entries()) {
    for (const [other, otherRect] of parts.slice(i + 1)) {
      expect(overlaps(rect, otherRect), `${name} and ${other}`).toBe(false);
    }
  }
}

/** The HUD's buttons a panel must leave in reach, by name. */
function hudButtons(viewport: Viewport): [string, Rect][] {
  const { slots } = skillBarLayout(viewport);
  const { columns } = beltStripLayout(viewport);
  const { buttons, townPortal } = panelButtonsLayout(viewport);
  return [
    ...SKILL_BAR_SLOTS.map((slot) => [`Skill Bar ${slot}`, slots[slot]]),
    ...columns.map((rect, column) => [`Belt Column ${column}`, rect]),
    ...PANELS.map((panel) => [`${panel} button`, buttons[panel]]),
    ["Town Portal button", townPortal],
  ] as [string, Rect][];
}

/** Each panel's rect on `viewport`, the Inventory's for each Belt. */
function panelRects(viewport: Viewport): [string, Rect][] {
  return [
    ["Hero panel", heroPanelLayout(viewport).panel],
    ["Skill Tree panel", skillTreePanelLayout(viewport).panel],
    ...BELT_ROWS.map(
      (rows) =>
        [
          `Inventory panel, ${rows} rows`,
          inventoryPanelLayout(viewport, rows).panel,
        ] as [string, Rect],
    ),
  ];
}

describe("the panels in the Compact Layout", () => {
  it.each(
    PHONES,
  )("fill the screen in one place on $width×$height, leaving the HUD's buttons in reach", (size) => {
    const viewport = viewportOf(size);
    const screen = { x: 0, y: 0, w: size.width, h: size.height };
    const [[, first], ...others] = panelRects(viewport);

    expect(viewport.compact).toBe(true);
    for (const [name, rect] of others) expect(rect, name).toEqual(first);
    expectInside(first, screen, "panel");
    expect(first.x).toBeGreaterThan(0);
    expect(first.y).toBeGreaterThan(0);
    // Most of the screen, so its cells and rows are big enough to use.
    expect(first.w).toBeGreaterThan(size.width * 0.85);
    expect(first.h).toBeGreaterThan(size.height * 0.75);
    for (const [name, rect] of hudButtons(viewport)) {
      expect(overlaps(first, rect), name).toBe(false);
    }
  });

  it.each(
    PHONES,
  )("lay the Hero panel's rows, buttons and close hint inside it, apart, on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const layout = heroPanelLayout(viewport);
    const derived = heroSheet(world).derived.length;
    const rows = [
      PANEL_ROWS.level,
      PANEL_ROWS.experience,
      ...ATTRIBUTES.map((_, i) => PANEL_ROWS.attributes + i),
      PANEL_ROWS.attributePoints,
      ...Array.from({ length: derived }, (_, i) => PANEL_ROWS.derived + i),
    ];
    const rowRects = rows.map(
      (row) => [`row ${row}`, heroPanelRow(viewport, row)] as [string, Rect],
    );

    for (const [name, rect] of rowRects) {
      expectInside(rect, layout.panel, name);
    }
    expectInside(layout.closeHint, layout.panel, "close hint");
    expectApart([
      ...rowRects,
      ["×", layout.closeButton],
      ["close hint", layout.closeHint],
    ]);
    for (const attribute of ATTRIBUTES) {
      const row = heroPanelRow(
        viewport,
        PANEL_ROWS.attributes + ATTRIBUTES.indexOf(attribute),
      );
      expectInside(layout.raise[attribute], row, `${attribute} +`);
      expectInside(layout.lower[attribute], row, `${attribute} −`);
    }
    expectInside(
      layout.accept,
      heroPanelRow(viewport, PANEL_ROWS.attributePoints),
      "Accept",
    );
    expectInside(layout.closeButton, layout.panel, "×");
  });

  it.each(
    PHONES,
  )("hit the Hero panel's buttons at their centres on $width×$height", (size) => {
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
    PHONES,
  )("lay the Skill Tree's rows inside it and hit its Skills at their centres on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const layout = skillTreePanelLayout(viewport);
    const at = (rect: Rect) =>
      skillTreeHitAt(viewport, centre(rect), world, true);
    // Room for 15 Skills: Bone 6, Summoning 4 and Curses 5.
    const rooms = fullRooms();
    const panel = skillTreePanelRect(viewport, rooms);
    const hint =
      (SKILL_TREE_PANEL.hintHeight + SKILL_TREE_PANEL.padding) *
      viewport.uiScale;

    expect(panel).toEqual(layout.panel);
    const slots: [string, Rect][] = [];
    for (const branch of BRANCHES) {
      slots.push([`${branch} heading`, skillTreeBranchRow(viewport, branch)]);
      for (let index = 0; index < rooms[branch]; index++) {
        slots.push([
          `${branch} ${index}`,
          skillTreeSkillRow(viewport, branch, index, rooms),
        ]);
      }
    }
    expect(slots).toHaveLength(15 + 3);
    for (const [name, rect] of slots) {
      expectInside(rect, panel, name);
      expect(rect.y + rect.h, `${name} over the hint`).toBeLessThanOrEqual(
        panel.y + panel.h - hint,
      );
      expect(rect.y, `${name} under the ×`).toBeGreaterThanOrEqual(
        layout.closeButton.y + layout.closeButton.h,
      );
    }
    expectApart(slots);
    for (const skill of SKILLS) {
      expectInside(layout.skills[skill], layout.panel, `${skill} rows`);
      expectInside(layout.raise[skill], layout.skills[skill], `${skill} +`);
      expect(at(layout.raise[skill])).toEqual({
        button: { type: "learn", skill },
      });
      const rows = layout.skills[skill];
      const name = { ...rows, w: layout.raise[skill].x - rows.x };
      expect(at(name)).toEqual({ button: { type: "pickUpSkill", skill } });
    }
    expect(overlaps(layout.closeButton, layout.skills.golem)).toBe(false);
    expect(at(layout.closeButton)).toEqual({
      button: { type: "close", panel: "skillTree" },
    });
  });

  it.each(
    PHONES,
  )("lay the Inventory's cells, slots and Belt Columns inside it, apart, and hit each at its centre on $width×$height", (size) => {
    const viewport = viewportOf(size);
    for (const rows of BELT_ROWS) {
      const layout = inventoryPanelLayout(viewport, rows);
      const at = (point: { x: number; y: number }) =>
        inventoryHitAt(viewport, point, true, false, rows);
      const { grid, cell, panel } = layout;
      const parts: [string, Rect][] = [
        ["grid", grid],
        ["×", layout.closeButton],
        ...EQUIPMENT_SLOTS.map(
          (slot) => [slot, layout.slots[slot]] as [string, Rect],
        ),
        ...layout.belt.flatMap((cells, column) =>
          cells.map(
            (rect, row) => [`Belt ${column},${row}`, rect] as [string, Rect],
          ),
        ),
      ];

      for (const [name, rect] of parts) expectInside(rect, panel, name);
      expectApart(parts);
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

  it.each([
    { rows: 1, atLeast: 30 },
    { rows: 2, atLeast: 30 },
    { rows: 3, atLeast: 27 },
    { rows: 4, atLeast: 24 },
  ])("make the Inventory's cells as big as the 640×360 screen has room for, with $rows Belt rows", ({
    rows,
    atLeast,
  }) => {
    const viewport = viewportOf({ width: 640, height: 360 });

    expect(inventoryPanelLayout(viewport, rows).cell).toBeGreaterThanOrEqual(
      atLeast,
    );
  });

  it("draws the Inventory's cells no bigger than native size on a roomy phone", () => {
    const viewport = viewportOf({ width: 844, height: 390 });

    for (const rows of BELT_ROWS) {
      expect(inventoryPanelLayout(viewport, rows).cell).toBeLessThanOrEqual(36);
    }
  });
});

describe("a point in the Compact Layout", () => {
  /** The menus with only `panel` open. */
  function shownWith(panel: Panel) {
    const menus = createMenus();
    menus.heroPanelOpen = panel === "hero";
    menus.inventoryOpen = panel === "inventory";
    menus.skillTreeOpen = panel === "skillTree";
    menus.questOpen = panel === "quest";
    return menus;
  }

  it.each(
    PHONES,
  )("goes to the open panel over the Level Up button on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const { levelUp } = heroPanelLayout(viewport);

    for (const panel of PANELS) {
      const hit = cursorHitAt(
        viewport,
        centre(levelUp),
        world,
        shownWith(panel),
      );
      expect(hit, panel).not.toEqual({ button: { type: "levelUp" } });
      expect(hit, panel).not.toBeNull();
    }
  });

  it.each(
    PHONES,
  )("still hits the Panel buttons and the Skill Bar with a panel open on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const { buttons } = panelButtonsLayout(viewport);
    const { slots } = skillBarLayout(viewport);

    for (const open of PANELS) {
      const shown = shownWith(open);
      for (const panel of PANELS) {
        expect(
          cursorHitAt(viewport, centre(buttons[panel]), world, shown),
        ).toEqual({ button: { type: "panelButton", panel } });
      }
      for (const slot of SKILL_BAR_SLOTS) {
        expect(
          cursorHitAt(viewport, centre(slots[slot]), world, shown),
        ).toEqual({ button: { type: "skillBarSlot", slot } });
      }
    }
  });
});
