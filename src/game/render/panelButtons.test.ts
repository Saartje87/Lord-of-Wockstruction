import { describe, expect, it } from "vitest";
import { overlaps } from "../sim/rect";
import { beltStripLayout } from "./beltStrip";
import { panelButtonHitAt, panelButtonsLayout } from "./panelButtons";
import { skillBarLayout } from "./skillBar";

describe("the Panel buttons' layout", () => {
  it.each([
    { width: 1280, height: 720 },
    { width: 1024, height: 640 },
  ])("sits right of the Skill Bar in line with it, clear of the Mana orb at $width px", (screen) => {
    const { hero, inventory, skillTree } = panelButtonsLayout(screen).buttons;
    const { slots } = skillBarLayout(screen);
    const buttons = [hero, inventory, skillTree];

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
    expect(skillTree.x + skillTree.w).toBeLessThan(screen.width - 144);
  });

  it("mirrors the Belt strip across the Skill Bar", () => {
    const screen = { width: 1280, height: 720 };
    const { hero } = panelButtonsLayout(screen).buttons;
    const { slots } = skillBarLayout(screen);
    const belt = beltStripLayout(screen).columns;

    expect(hero.x - (slots.right.x + slots.right.w)).toBe(
      slots.key1.x - (belt[3].x + belt[3].w),
    );
  });
});

describe("a click on the Panel buttons", () => {
  const screen = { width: 1280, height: 720 };
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
