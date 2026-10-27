import { describe, expect, it } from "vitest";
import { createMenus, noPendingPoints, PANELS } from "../menus";
import { beltRows, emptyBelt } from "../sim/belt";
import { middleOf, overlaps, type Rect } from "../sim/rect";
import { emptySkillBar } from "../sim/skillBar";
import { ATTRIBUTES, type Attribute, createWorld, step } from "../sim/world";
import type { ItemType } from "../tuning/items";
import { type Viewport, viewportOf } from "../viewport";
import { beltStripLayout } from "./beltStrip";
import { cursorHitAt } from "./cursorHit";
import { heroPanelLayout, heroPanelRow, PANEL_ROWS } from "./heroPanel";
import { inventoryPanelLayout } from "./inventoryPanel";
import { hoveredPanelButton, panelButtonsLayout } from "./panelButtons";
import { skillBarLayout } from "./skillBar";
import { skillTreePanelLayout } from "./skillTreePanel";
import { touchControlsLayout } from "./touchControls";

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
const SMALL = {
  width: 1024,
  height: 640,
  uiScale: 1,
  worldZoom: 1,
  compact: false,
  rotateNotice: null,
};
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

describe("with touch at a large UI Scale", () => {
  const screen = { ...SMALL, width: 2560, height: 1440, uiScale: 2 };

  it("a × drawn 44 px square takes no touch off it", () => {
    const { closeButton } = heroPanelLayout(screen);
    expect(closeButton.w).toBe(44);
    const point = { x: closeButton.x - 2, y: middleOf(closeButton).y };
    expect(
      cursorHitAt(
        screen,
        point,
        world("sash"),
        { ...createMenus(), heroPanelOpen: true },
        true,
      ),
    ).toEqual({ button: null });
  });
});

/** The two phone sizes, held sideways, in the Compact Layout. */
const PHONES = [
  { width: 640, height: 320 },
  { width: 915, height: 330 },
];
const heroOpen = { ...createMenus(), heroPanelOpen: true };

describe("with touch, a near miss on a panel's ×", () => {
  it.each(
    PHONES,
  )("left of the Hero panel's × closes it at $width×$height", (size) => {
    const screen = viewportOf(size);
    const { closeButton } = heroPanelLayout(screen);
    const point = { x: closeButton.x - 5, y: middleOf(closeButton).y };

    expect(cursorHitAt(screen, point, world("sash"), heroOpen, true)).toEqual({
      button: { type: "close", panel: "hero" },
    });
  });

  /** Each panel open on its own, with where its × is drawn. */
  const panels = [
    { panel: "hero", open: heroOpen, layout: heroPanelLayout },
    {
      panel: "inventory",
      open: inventoryOpen,
      layout: (screen: Viewport) => inventoryPanelLayout(screen, 1),
    },
    {
      panel: "skillTree",
      open: { ...createMenus(), skillTreeOpen: true },
      layout: skillTreePanelLayout,
    },
  ] as const;
  /** Points just off each side of `rect`, 3 px out, by its middle. */
  const nearMisses = (rect: Rect) => {
    const { x, y } = middleOf(rect);
    return [
      { x: rect.x - 3, y },
      { x: rect.x + rect.w + 3, y },
      { x, y: rect.y - 3 },
      { x, y: rect.y + rect.h + 3 },
    ];
  };

  describe.each([
    ...PHONES,
    { width: 1280, height: 720 },
  ])("at $width×$height", (size) => {
    const screen = viewportOf(size);

    it.each(panels)("closes the $panel panel from any side", ({
      panel,
      open,
      layout,
    }) => {
      const { closeButton } = layout(screen);
      for (const point of nearMisses(closeButton)) {
        expect(cursorHitAt(screen, point, world("sash"), open, true)).toEqual({
          button: { type: "close", panel },
        });
      }
    });

    it.each(panels)("but a mouse there doesn't close the $panel panel", ({
      open,
      layout,
    }) => {
      const { closeButton } = layout(screen);
      for (const point of nearMisses(closeButton)) {
        const hit = cursorHitAt(screen, point, world("sash"), open, false);
        expect(hit).not.toHaveProperty("button.type", "close");
      }
    });
  });
});

describe.each(PHONES)("with touch at $width×$height", (size) => {
  const screen = viewportOf(size);
  const { buttons } = panelButtonsLayout(screen);
  const shut = createMenus();
  const panelButton = (panel: string) => ({
    button: { type: "panelButton", panel },
  });

  it.each([
    shut,
    heroOpen,
  ])("a near miss left or right of a Panel button opens or shuts its panel", (open) => {
    for (const panel of PANELS) {
      const rect = buttons[panel];
      const { y } = middleOf(rect);
      for (const x of [rect.x - 2, rect.x + rect.w + 2]) {
        expect(
          cursorHitAt(screen, { x, y }, world("sash"), open, true),
        ).toEqual(panelButton(panel));
      }
    }
  });

  it("a point between the × and the Panel button beside it hits the nearer", () => {
    const { closeButton } = heroPanelLayout(screen);
    const { hero } = buttons;
    const y = middleOf(closeButton).y;
    const w = world("sash");
    expect(
      cursorHitAt(
        screen,
        { x: closeButton.x + closeButton.w + 2, y },
        w,
        heroOpen,
        true,
      ),
    ).toEqual({ button: { type: "close", panel: "hero" } });
    expect(
      cursorHitAt(screen, { x: hero.x - 2, y }, w, heroOpen, true),
    ).toEqual(panelButton("hero"));
  });

  it("a point between two Panel buttons hits the nearer", () => {
    const { hero, inventory } = buttons;
    const { x } = middleOf(hero);
    const w = world("sash");
    expect(
      cursorHitAt(screen, { x, y: hero.y + hero.h + 1 }, w, shut, true),
    ).toEqual(panelButton("hero"));
    expect(
      cursorHitAt(screen, { x, y: inventory.y - 1 }, w, shut, true),
    ).toEqual(panelButton("inventory"));
  });

  it("a near miss on a Panel button leaves the pause button beside it its own", () => {
    const { pause } = touchControlsLayout(screen);
    const point = { x: pause.x + pause.w + 1, y: middleOf(pause).y };
    expect(cursorHitAt(screen, point, world("sash"), shut, true)).toBeNull();
  });

  it.each([
    shut,
    inventoryOpen,
  ])("points on the Skill Bar, the Belt strip and the Inventory hit what a mouse does", (open) => {
    const w = world("sash");
    const inventory = inventoryPanelLayout(screen, beltRows(w));
    const rects = [
      ...Object.values(skillBarLayout(screen).slots),
      ...beltStripLayout(screen).columns,
      ...(open.inventoryOpen
        ? [
            ...Object.values(inventory.slots),
            ...inventory.belt.flat(),
            inventory.grid,
          ]
        : []),
    ];
    for (const rect of rects) {
      // Its middle and just inside each corner.
      for (const point of [
        middleOf(rect),
        { x: rect.x + 1, y: rect.y + 1 },
        { x: rect.x + rect.w - 1, y: rect.y + 1 },
        { x: rect.x + 1, y: rect.y + rect.h - 1 },
        { x: rect.x + rect.w - 1, y: rect.y + rect.h - 1 },
      ]) {
        expect(cursorHitAt(screen, point, w, open, true)).toEqual(
          cursorHitAt(screen, point, w, open, false),
        );
      }
    }
  });

  it("the ×'s hit area reaches no further than 44 px square", () => {
    const { closeButton } = heroPanelLayout(screen);
    const reach = (44 - closeButton.w) / 2;
    const { x, y } = middleOf(closeButton);
    for (const point of [
      { x: closeButton.x - reach - 1, y },
      { x, y: closeButton.y + closeButton.h + reach + 1 },
    ]) {
      expect(cursorHitAt(screen, point, world("sash"), heroOpen, true)).toEqual(
        { button: null },
      );
    }
  });

  it("a mouse's near miss on a Panel button hits no Panel button", () => {
    for (const open of [shut, heroOpen]) {
      for (const panel of PANELS) {
        const rect = buttons[panel];
        for (const point of [
          { x: rect.x - 2, y: middleOf(rect).y },
          { x: rect.x + rect.w + 2, y: middleOf(rect).y },
          { x: middleOf(rect).x, y: rect.y + rect.h + 1 },
        ]) {
          const hit = cursorHitAt(screen, point, world("sash"), open);
          expect(hoveredPanelButton(hit)).toBeNull();
        }
      }
    }
  });
});

/** A Level 2 Hero with 5 Attribute Points unspent, holding an Axe. */
function withPoints() {
  return createWorld({
    areas: { town },
    seed: 1,
    progress: {
      level: 2,
      experience: 500,
      strength: 20,
      dexterity: 20,
      vitality: 20,
      energy: 20,
      attributePoints: 5,
      skillPoints: 0,
      skillLevels: { golem: 1 },
      skillBar: emptySkillBar(),
    },
  });
}

/** The Hero panel open with `pending` Pending Attribute Points. */
function heroPending(pending: Partial<Record<Attribute, number>>) {
  return {
    ...heroOpen,
    pendingPoints: { ...noPendingPoints(), ...pending },
  };
}
/** One Pending Attribute Point on each Attribute: every + and − shown. */
const allPending = heroPending({
  strength: 1,
  dexterity: 1,
  vitality: 1,
  energy: 1,
});

describe.each(
  PHONES,
)("with touch on the Hero panel at $width×$height", (size) => {
  const screen = viewportOf(size);
  const layout = heroPanelLayout(screen);
  const raise = (attribute: Attribute) => ({
    button: { type: "raise", attribute },
  });
  const lower = (attribute: Attribute) => ({
    button: { type: "lower", attribute },
  });
  const accept = { button: { type: "accept" } };

  it("a point on an Attribute's row left of its + raises that Attribute", () => {
    for (const attribute of ATTRIBUTES) {
      const plus = layout.raise[attribute];
      // Inside the 44 px wide hit area centred on the +.
      const point = { x: plus.x - (44 - plus.w) / 2 + 1, y: middleOf(plus).y };
      expect(cursorHitAt(screen, point, withPoints(), heroOpen, true)).toEqual(
        raise(attribute),
      );
    }
  });

  it("but no further left than a 44 px wide hit area", () => {
    const plus = layout.raise.strength;
    const point = { x: plus.x - (44 - plus.w) / 2 - 1, y: middleOf(plus).y };
    expect(cursorHitAt(screen, point, withPoints(), heroOpen, true)).toEqual({
      button: null,
    });
  });

  it("a − on the row below doesn't stop a + reaching left along its own row", () => {
    const plus = layout.raise.strength;
    const point = { x: plus.x - 10, y: middleOf(plus).y };
    const shown = heroPending({ dexterity: 1 });
    expect(cursorHitAt(screen, point, withPoints(), shown, true)).toEqual(
      raise("strength"),
    );
  });

  it("a point between a row's − and + hits the nearer", () => {
    for (const attribute of ATTRIBUTES) {
      const minus = layout.lower[attribute];
      const plus = layout.raise[attribute];
      const { y } = middleOf(plus);
      const gap = plus.x - (minus.x + minus.w);
      expect(gap).toBeGreaterThan(2);
      const w = withPoints();
      expect(
        cursorHitAt(screen, { x: plus.x - 1, y }, w, allPending, true),
      ).toEqual(raise(attribute));
      expect(
        cursorHitAt(
          screen,
          { x: minus.x + minus.w + 1, y },
          w,
          allPending,
          true,
        ),
      ).toEqual(lower(attribute));
      // And left of the −, along its row.
      expect(
        cursorHitAt(screen, { x: minus.x - 5, y }, w, allPending, true),
      ).toEqual(lower(attribute));
    }
  });

  it("no + or − hit area reaches into the row above or below", () => {
    ATTRIBUTES.forEach((attribute, i) => {
      const row = heroPanelRow(screen, PANEL_ROWS.attributes + i);
      expect(row.h).toBeCloseTo((21 * screen.uiScale) / 0.75);
      for (const [rect, hit] of [
        [layout.raise[attribute], raise(attribute)],
        [layout.lower[attribute], lower(attribute)],
      ] as const) {
        const { x } = middleOf(rect);
        const w = withPoints();
        const at = (y: number) =>
          cursorHitAt(screen, { x, y }, w, allPending, true);
        // Its whole row's height is its own...
        expect(at(row.y + 0.5)).toEqual(hit);
        expect(at(row.y + row.h - 0.5)).toEqual(hit);
        // ...and no more.
        expect(at(row.y - 0.5)).not.toEqual(hit);
        expect(at(row.y + row.h + 0.5)).not.toEqual(hit);
      }
    });
  });

  it("a point just beside Accept accepts the Pending Attribute Points", () => {
    const rect = layout.accept;
    const { x, y } = middleOf(rect);
    const row = heroPanelRow(screen, PANEL_ROWS.attributePoints);
    for (const point of [
      { x: rect.x - 2, y },
      { x: rect.x + rect.w + 2, y },
      { x, y: row.y + 0.5 },
      { x, y: row.y + row.h - 0.5 },
    ]) {
      expect(
        cursorHitAt(screen, point, withPoints(), allPending, true),
      ).toEqual(accept);
    }
    // Not into the Energy row above it.
    expect(
      cursorHitAt(
        screen,
        { x, y: row.y - 0.5 },
        withPoints(),
        allPending,
        true,
      ),
    ).not.toEqual(accept);
  });

  it("a mouse at the same near misses hits no button", () => {
    const w = withPoints();
    const near: { x: number; y: number }[] = [];
    for (const attribute of ATTRIBUTES) {
      const minus = layout.lower[attribute];
      const plus = layout.raise[attribute];
      const { y } = middleOf(plus);
      near.push(
        { x: plus.x - 1, y },
        { x: minus.x + minus.w + 1, y },
        { x: minus.x - 5, y },
        { x: middleOf(plus).x, y: plus.y - 1 },
      );
    }
    const rect = layout.accept;
    near.push(
      { x: rect.x - 2, y: middleOf(rect).y },
      { x: rect.x + rect.w + 2, y: middleOf(rect).y },
    );
    for (const point of near) {
      expect(cursorHitAt(screen, point, w, allPending, false)).toEqual({
        button: null,
      });
    }
  });
});
