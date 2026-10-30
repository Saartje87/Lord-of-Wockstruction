import { describe, expect, it } from "vitest";
import {
  clickLevelUp,
  clickPanelButton,
  createMenus,
  PANELS,
  pressKey,
} from "../menus";
import { overlaps } from "../sim/rect";
import { viewportOf } from "../viewport";
import { beltStripLayout } from "./beltStrip";
import { heroPanelLayout } from "./heroPanel";
import { inventoryPanelLayout } from "./inventoryPanel";
import {
  hoveredPanelButton,
  panelButtonHitAt,
  panelButtonsLayout,
  panelButtonsSheet,
  panelButtonTooltipRect,
  townPortalButtonSheet,
} from "./panelButtons";
import { skillBarLayout } from "./skillBar";
import { skillTreePanelLayout } from "./skillTreePanel";

describe("the Panel buttons' layout", () => {
  it.each([
    { width: 1280, height: 720 },
    { width: 1024, height: 640 },
  ])("sits right of the Skill Bar in line with it, clear of the Mana orb at $width px", (size) => {
    const screen = viewportOf(size);
    const { hero, inventory, skillTree, quest } =
      panelButtonsLayout(screen).buttons;
    const { slots } = skillBarLayout(screen);
    const buttons = [hero, inventory, skillTree, quest];

    for (let i = 1; i < buttons.length; i++) {
      expect(buttons[i].x).toBeGreaterThan(buttons[i - 1].x);
      expect(overlaps(buttons[i], buttons[i - 1])).toBe(false);
    }
    for (const button of buttons) {
      expect(button.y).toBe(slots.right.y);
      expect(button.w).toBe(slots.right.w);
      expect(button.h).toBe(slots.right.h);
    }
    expect(hero.x).toBeGreaterThan(slots.right.x + slots.right.w);
    // Clear of the Mana orb's 144 px.
    expect(quest.x + quest.w).toBeLessThan(screen.width - 144);
  });

  it.each([
    { width: 1280, height: 720 },
    { width: 1024, height: 640 },
    { width: 1920, height: 1080 },
  ])("puts the round Town Portal button after the Panel buttons, centred on their row, clear of the Mana orb at $width×$height", (size) => {
    const screen = viewportOf(size);
    const { buttons, townPortal } = panelButtonsLayout(screen);
    const { quest, skillTree } = buttons;

    // 36 px across at native scale, a little smaller than a Panel button.
    expect(townPortal.w).toBeCloseTo(36 * screen.uiScale);
    expect(townPortal.h).toBeCloseTo(36 * screen.uiScale);
    expect(townPortal.y + townPortal.h / 2).toBeCloseTo(quest.y + quest.h / 2);
    expect(townPortal.x - (quest.x + quest.w)).toBeCloseTo(
      quest.x - (skillTree.x + skillTree.w),
    );
    // Clear of the Mana orb's 144 px at native scale.
    expect(townPortal.x + townPortal.w).toBeLessThan(
      screen.width - 144 * screen.uiScale,
    );
  });

  it.each([
    { width: 1180, height: 820 },
    { width: 1024, height: 768 },
    { width: 1366, height: 1024 },
  ])("puts the round Town Portal button above the last Panel button where the row would reach the Mana orb at $width×$height", (size) => {
    const screen = viewportOf(size);
    const { buttons, townPortal } = panelButtonsLayout(screen);
    const { quest } = buttons;

    expect(townPortal.w).toBeCloseTo(36 * screen.uiScale);
    expect(townPortal.x + townPortal.w / 2).toBeCloseTo(quest.x + quest.w / 2);
    expect(townPortal.y + townPortal.h).toBeLessThan(quest.y);
    for (const panel of PANELS) {
      expect(overlaps(townPortal, buttons[panel]), panel).toBe(false);
    }
    expect(townPortal.x + townPortal.w).toBeLessThan(
      screen.width - 144 * screen.uiScale,
    );
  });

  it.each([
    { width: 640, height: 320 },
    { width: 640, height: 360 },
    { width: 844, height: 390 },
    { width: 915, height: 330 },
  ])("puts the Town Portal button under the Panel buttons' column in the Compact Layout on $width×$height", (size) => {
    const screen = viewportOf(size);
    const { buttons, townPortal } = panelButtonsLayout(screen);
    const { quest } = buttons;

    expect(screen.compact).toBe(true);
    expect(townPortal.w).toBeCloseTo(36 * screen.uiScale);
    expect(townPortal.x + townPortal.w / 2).toBeCloseTo(quest.x + quest.w / 2);
    expect(townPortal.y).toBeGreaterThan(quest.y + quest.h);
    for (const panel of PANELS) {
      expect(overlaps(townPortal, buttons[panel]), panel).toBe(false);
    }
  });

  it("mirrors the Belt strip across the Skill Bar", () => {
    const screen = viewportOf({ width: 1280, height: 720 });
    const { hero } = panelButtonsLayout(screen).buttons;
    const { slots } = skillBarLayout(screen);
    const belt = beltStripLayout(screen).columns;

    expect(hero.x - (slots.right.x + slots.right.w)).toBe(
      slots.key1.x - (belt[3].x + belt[3].w),
    );
  });
});

describe("a Panel button's or the Town Portal button's tooltip", () => {
  // "Skill Tree (T)" in the tooltip's look at the UI Scale 0.75.
  const size = { w: 96, h: 26 };
  const gap = 4.5;

  it("sits over its button on the HUD", () => {
    const screen = viewportOf({ width: 1280, height: 720 });
    const { buttons, townPortal } = panelButtonsLayout(screen);
    const all = { ...buttons, townPortal };

    for (const name of [...PANELS, "townPortal"] as const) {
      const tooltip = panelButtonTooltipRect(screen, name, size, gap);
      const button = all[name];
      expect(tooltip.y + tooltip.h).toBeLessThanOrEqual(button.y);
      expect(tooltip.x + tooltip.w / 2).toBeCloseTo(button.x + button.w / 2);
    }
  });

  it.each([
    { width: 640, height: 360 },
    { width: 844, height: 390 },
  ])("covers no Panel button, the Town Portal button nor an open panel's × in the Compact Layout on $width×$height", (screenSize) => {
    const screen = viewportOf(screenSize);
    const { buttons, townPortal } = panelButtonsLayout(screen);
    const closes = [
      heroPanelLayout(screen).closeButton,
      skillTreePanelLayout(screen).closeButton,
      inventoryPanelLayout(screen, 4).closeButton,
    ];

    for (const button of [...PANELS, "townPortal"] as const) {
      const tooltip = panelButtonTooltipRect(screen, button, size, gap);
      expect(tooltip.x).toBeGreaterThanOrEqual(0);
      expect(tooltip.y).toBeGreaterThanOrEqual(0);
      expect(tooltip.x + tooltip.w).toBeLessThanOrEqual(screen.width);
      for (const other of PANELS) {
        expect(overlaps(tooltip, buttons[other]), other).toBe(false);
      }
      expect(overlaps(tooltip, townPortal), "Town Portal button").toBe(false);
      for (const close of closes) {
        expect(overlaps(tooltip, close), "×").toBe(false);
      }
    }
  });
});

describe("a click on the Panel buttons", () => {
  const screen = viewportOf({ width: 1280, height: 720 });
  const { buttons } = panelButtonsLayout(screen);

  it.each([
    "hero",
    "inventory",
    "skillTree",
  ] as const)("hands back the %s Panel button under it", (panel) => {
    const rect = buttons[panel];
    const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };

    expect(panelButtonHitAt(screen, centre)).toEqual({
      button: { type: "panelButton", panel },
    });
  });

  it("hands back a Panel button at its edges", () => {
    const { inventory } = buttons;

    expect(
      panelButtonHitAt(screen, { x: inventory.x, y: inventory.y }),
    ).toEqual({ button: { type: "panelButton", panel: "inventory" } });
  });

  it("is for the World in the gaps between them and off them", () => {
    const { hero, inventory } = buttons;
    const gap = { x: (hero.x + hero.w + inventory.x) / 2, y: hero.y + 10 };

    expect(panelButtonHitAt(screen, gap)).toBeNull();
    expect(
      panelButtonHitAt(screen, { x: hero.x + 10, y: hero.y - 5 }),
    ).toBeNull();
    expect(panelButtonHitAt(screen, { x: 640, y: 300 })).toBeNull();
  });
});

describe("a click on the Town Portal button", () => {
  it.each([
    { width: 1280, height: 720 },
    { width: 640, height: 360 },
  ])("hands back the Town Portal button inside its circle, and nothing off it, on $width×$height", (size) => {
    const screen = viewportOf(size);
    const { townPortal } = panelButtonsLayout(screen);
    const centre = {
      x: townPortal.x + townPortal.w / 2,
      y: townPortal.y + townPortal.h / 2,
    };
    const onEdge = { x: townPortal.x + 1, y: centre.y };
    // Inside its square, outside its circle.
    const corner = { x: townPortal.x + 1, y: townPortal.y + 1 };

    for (const point of [centre, onEdge]) {
      expect(panelButtonHitAt(screen, point)).toEqual({
        button: { type: "townPortal" },
      });
    }
    expect(panelButtonHitAt(screen, corner)).toBeNull();
    expect(
      panelButtonHitAt(screen, { x: townPortal.x - 1, y: centre.y }),
    ).toBeNull();
  });
});

describe("the Panel buttons' sheet", () => {
  const alive = { heroDead: false };

  it("shows a Panel button lit while its panel is opened by key", () => {
    const menus = createMenus();

    pressKey(menus, "i", 1000, alive);

    expect(panelButtonsSheet(menus, alive).map(({ lit }) => lit)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it("shows a Panel button lit while its panel is opened by its Panel button", () => {
    const menus = createMenus();

    clickPanelButton(menus, "hero", alive);

    expect(panelButtonsSheet(menus, alive).map(({ lit }) => lit)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("shows the Hero and Skill Tree buttons lit while Level Up opened their panels", () => {
    const menus = createMenus();

    clickLevelUp(menus, { ...alive, attributePoints: 5, skillPoints: 1 });

    expect(panelButtonsSheet(menus, alive).map(({ lit }) => lit)).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it("shows a Panel button unlit once its panel shuts", () => {
    const menus = createMenus();

    pressKey(menus, "t", 1000, alive);
    clickPanelButton(menus, "skillTree", alive);

    expect(panelButtonsSheet(menus, alive).map(({ lit }) => lit)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("gives each Panel button its name and key as its tooltip", () => {
    const menus = createMenus();

    expect(
      panelButtonsSheet(menus, alive).map(({ tooltip }) => tooltip),
    ).toEqual(["Hero (C)", "Inventory (I)", "Skill Tree (T)", "Quests (Q)"]);
  });

  it("shows every Panel button dimmed while the Hero lies in Death", () => {
    const menus = createMenus();

    expect(
      panelButtonsSheet(menus, { heroDead: true }).map(({ dimmed }) => dimmed),
    ).toEqual([true, true, true, true]);
  });
});

describe("the Town Portal button's sheet", () => {
  it("shows it greyed out in Town", () => {
    const sheet = townPortalButtonSheet(
      { heroDead: false, inTown: true },
      "mouseAndKeyboard",
    );

    expect(sheet.greyed).toBe(true);
  });

  it("shows it greyed out while the Hero lies in Death, as the Panel buttons dim", () => {
    const sheet = townPortalButtonSheet(
      { heroDead: true, inTown: false },
      "mouseAndKeyboard",
    );

    expect(sheet.greyed).toBe(true);
  });

  it("shows it ready outside Town", () => {
    const sheet = townPortalButtonSheet(
      { heroDead: false, inTown: false },
      "mouseAndKeyboard",
    );

    expect(sheet.greyed).toBe(false);
  });

  it("names its key or button following the Active Input", () => {
    const hero = { heroDead: false, inTown: false };

    expect(townPortalButtonSheet(hero, "mouseAndKeyboard").tooltip).toBe(
      "Town Portal (P)",
    );
    expect(townPortalButtonSheet(hero, "controller").tooltip).toBe(
      "Town Portal (LB)",
    );
  });
});

describe("the hovered Panel button", () => {
  it("is the Panel button or Town Portal button under the cursor, or null on anything else", () => {
    const onSkillTree = {
      button: { type: "panelButton", panel: "skillTree" },
    } as const;

    expect(hoveredPanelButton(onSkillTree)).toBe("skillTree");
    expect(hoveredPanelButton({ button: { type: "townPortal" } })).toBe(
      "townPortal",
    );
    expect(hoveredPanelButton({ button: { type: "levelUp" } })).toBeNull();
    expect(hoveredPanelButton({ button: null })).toBeNull();
    expect(hoveredPanelButton({ inventory: null })).toBeNull();
    expect(hoveredPanelButton(null)).toBeNull();
  });
});
