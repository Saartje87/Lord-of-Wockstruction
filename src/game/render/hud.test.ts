import { describe, expect, it } from "vitest";
import { createMenus } from "../menus";
import { overlaps, type Rect } from "../sim/rect";
import { emptySkillBar, SKILL_BAR_SLOTS } from "../sim/skillBar";
import { createWorld, FRESH_PROGRESS } from "../sim/world";
import { viewportOf } from "../viewport";
import { beltStripLayout } from "./beltStrip";
import { cursorHitAt } from "./cursorHit";
import { experienceBarLayout } from "./experienceBar";
import { heroPanelLayout } from "./heroPanel";
import { type OrbCircle, orbsLayout } from "./orbs";
import { PANEL_BUTTONS, panelButtonsLayout } from "./panelButtons";
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

/** A Level 2 Hero with points unspent, so the Level Up button shows. */
const world = createWorld({
  areas: { town },
  seed: 1,
  progress: {
    ...FRESH_PROGRESS,
    level: 2,
    experience: 500,
    attributePoints: 5,
    skillPoints: 1,
    skillBar: emptySkillBar(),
  },
});

/** The screens the HUD is checked on: desktops and a tablet. */
const SCREENS = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 1180, height: 820 },
];

/** The square an orb is drawn in, its stone rim included. */
function orbBox({ x, y, radius, rim }: OrbCircle): Rect {
  const outer = radius + rim;
  return { x: x - outer, y: y - outer, w: 2 * outer, h: 2 * outer };
}

function centre(rect: Rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/** Every part of the HUD as laid out on `viewport`, by name. */
function hudParts(viewport: ReturnType<typeof viewportOf>) {
  const { slots } = skillBarLayout(viewport);
  const { columns } = beltStripLayout(viewport);
  const { buttons } = panelButtonsLayout(viewport);
  const orbs = orbsLayout(viewport);
  return [
    ...SKILL_BAR_SLOTS.map((slot) => [`Skill Bar ${slot}`, slots[slot]]),
    ...columns.map((rect, column) => [`Belt Column ${column}`, rect]),
    ...PANEL_BUTTONS.map((panel) => [`${panel} button`, buttons[panel]]),
    ["Life orb", orbBox(orbs.life)],
    ["Mana orb", orbBox(orbs.mana)],
    ["Experience bar", experienceBarLayout(viewport)],
    ["Level Up button", heroPanelLayout(viewport).levelUp],
  ] as [string, Rect][];
}

describe("the HUD at the UI Scale", () => {
  it.each(SCREENS)("fits inside $width×$height without overlapping", (size) => {
    const parts = hudParts(viewportOf(size));

    for (const [name, rect] of parts) {
      expect(rect.x, name).toBeGreaterThanOrEqual(0);
      expect(rect.y, name).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w, name).toBeLessThanOrEqual(size.width);
      expect(rect.y + rect.h, name).toBeLessThanOrEqual(size.height);
    }
    for (const [i, [name, rect]] of parts.entries()) {
      for (const [other, otherRect] of parts.slice(i + 1)) {
        expect(overlaps(rect, otherRect), `${name} and ${other}`).toBe(false);
      }
    }
  });

  it.each(
    SCREENS,
  )("draws the orbs, strip and Level Up button at the UI Scale on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const { strip, life, mana } = orbsLayout(viewport);
    const { levelUp } = heroPanelLayout(viewport);

    // At native scale: 52 px orbs in an 8 px rim, a 34 px strip, a 96×26
    // Level Up button.
    expect(life.radius).toBeCloseTo(52 * viewport.uiScale);
    expect(life.rim).toBeCloseTo(8 * viewport.uiScale);
    expect(mana.radius).toBeCloseTo(life.radius);
    expect(strip.h).toBeCloseTo(34 * viewport.uiScale);
    expect(strip).toMatchObject({ x: 0, w: size.width });
    expect(strip.y + strip.h).toBe(size.height);
    expect(levelUp.w).toBeCloseTo(96 * viewport.uiScale);
    expect(levelUp.h).toBeCloseTo(26 * viewport.uiScale);
    // Mirrored across the screen.
    expect(life.x + mana.x).toBeCloseTo(size.width);
    expect(life.y).toBe(mana.y);
  });

  it.each(
    SCREENS,
  )("runs the Experience bar along the strip between the orbs on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const { strip, life, mana } = orbsLayout(viewport);
    const bar = experienceBarLayout(viewport);

    expect(bar.x).toBeGreaterThan(life.x + life.radius + life.rim);
    expect(bar.x + bar.w).toBeLessThan(mana.x - mana.radius - mana.rim);
    expect(bar.y).toBeGreaterThanOrEqual(strip.y);
    expect(bar.y + bar.h).toBe(strip.y + strip.h);
  });

  it.each(
    SCREENS,
  )("hits each button at its centre on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const shown = createMenus();
    const at = (rect: Rect) =>
      cursorHitAt(viewport, centre(rect), world, shown);
    const { slots } = skillBarLayout(viewport);
    const { columns } = beltStripLayout(viewport);
    const { buttons } = panelButtonsLayout(viewport);

    for (const slot of SKILL_BAR_SLOTS) {
      expect(at(slots[slot])).toEqual({
        button: { type: "skillBarSlot", slot },
      });
    }
    for (const [beltColumn, rect] of columns.entries()) {
      expect(at(rect)).toEqual({ button: null, beltColumn });
    }
    for (const panel of PANEL_BUTTONS) {
      expect(at(buttons[panel])).toEqual({
        button: { type: "panelButton", panel },
      });
    }
    expect(at(heroPanelLayout(viewport).levelUp)).toEqual({
      button: { type: "levelUp" },
    });
  });
});
