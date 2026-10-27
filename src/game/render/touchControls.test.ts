import { describe, expect, it } from "vitest";
import { createMenus, PANELS } from "../menus";
import { overlaps, type Rect } from "../sim/rect";
import { SKILL_BAR_SLOTS } from "../sim/skillBar";
import { viewportOf } from "../viewport";
import { beltStripLayout } from "./beltStrip";
import { experienceBarLayout } from "./experienceBar";
import { heroPanelLayout } from "./heroPanel";
import { nameplateLayout } from "./hover";
import { type OrbCircle, orbsLayout } from "./orbs";
import { panelButtonsLayout } from "./panelButtons";
import { skillBarLayout } from "./skillBar";
import { touchControlsLayout, touchControlsShown } from "./touchControls";

/** Desktops, a tablet, and phones held sideways in the Compact Layout. */
const SCREENS = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 1180, height: 820 },
  { width: 640, height: 360 },
  { width: 844, height: 390 },
];

function orbBox({ x, y, radius, rim }: OrbCircle): Rect {
  const outer = radius + rim;
  return { x: x - outer, y: y - outer, w: 2 * outer, h: 2 * outer };
}

/** The HUD the touch controls must leave clear, by name. */
function hudParts(viewport: ReturnType<typeof viewportOf>) {
  const { slots } = skillBarLayout(viewport);
  const { columns } = beltStripLayout(viewport);
  const { buttons } = panelButtonsLayout(viewport);
  const orbs = orbsLayout(viewport);
  return [
    ...SKILL_BAR_SLOTS.map((slot) => [`Skill Bar ${slot}`, slots[slot]]),
    ...columns.map((rect, column) => [`Belt Column ${column}`, rect]),
    ...PANELS.map((panel) => [`${panel} button`, buttons[panel]]),
    ["Life orb", orbBox(orbs.life)],
    ["Mana orb", orbBox(orbs.mana)],
    ["Experience bar", experienceBarLayout(viewport)],
    ["Level Up button", heroPanelLayout(viewport).levelUp],
    ["nameplate", nameplateLayout(viewport).panel],
  ] as [string, Rect][];
}

/** Every touch control as laid out on `viewport`, by name. */
function touchParts(viewport: ReturnType<typeof viewportOf>) {
  const { stickZone, attack, skills, pause } = touchControlsLayout(viewport);
  return [
    ["Virtual Stick zone", stickZone],
    ["attack button", attack],
    ["pause button", pause],
    ...SKILL_BAR_SLOTS.map((slot) => [`Skill button ${slot}`, skills[slot]]),
  ] as [string, Rect][];
}

describe("the touch controls at the UI Scale", () => {
  it.each(
    SCREENS,
  )("fit inside $width×$height clear of each other and the HUD", (size) => {
    const viewport = viewportOf(size);
    const parts = touchParts(viewport);

    for (const [name, rect] of parts) {
      expect(rect.x, name).toBeGreaterThanOrEqual(0);
      expect(rect.y, name).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w, name).toBeLessThanOrEqual(size.width);
      expect(rect.y + rect.h, name).toBeLessThanOrEqual(size.height);
      for (const [hud, hudRect] of hudParts(viewport)) {
        expect(overlaps(rect, hudRect), `${name} and ${hud}`).toBe(false);
      }
    }
    for (const [i, [name, rect]] of parts.entries()) {
      for (const [other, otherRect] of parts.slice(i + 1)) {
        expect(overlaps(rect, otherRect), `${name} and ${other}`).toBe(false);
      }
    }
  });

  it.each(SCREENS)("sizes them at the UI Scale on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const { attack, skills, stick } = touchControlsLayout(viewport);

    // At native scale: a 72 px attack button, 48 px Skill buttons and a
    // Virtual Stick 56 px in reach.
    expect(attack.w).toBeCloseTo(72 * viewport.uiScale);
    expect(attack.h).toBeCloseTo(72 * viewport.uiScale);
    for (const slot of SKILL_BAR_SLOTS) {
      expect(skills[slot].w).toBeCloseTo(48 * viewport.uiScale);
    }
    expect(stick.reach).toBeCloseTo(56 * viewport.uiScale);
  });

  it.each(
    SCREENS,
  )("keeps the stick bottom left and the buttons bottom right on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const { stickZone, stick, attack } = touchControlsLayout(viewport);

    expect(stickZone.x + stickZone.w).toBeLessThanOrEqual(size.width / 2);
    expect(stickZone.y + stickZone.h).toBeGreaterThan(size.height / 2);
    // The Virtual Stick rests inside its zone.
    expect(stick.rest.x - stick.reach).toBeGreaterThanOrEqual(stickZone.x);
    expect(stick.rest.y + stick.reach).toBeCloseTo(stickZone.y + stickZone.h);
    expect(attack.x).toBeGreaterThan(size.width / 2);
    expect(attack.y).toBeGreaterThan(size.height / 2);
  });

  it.each(
    SCREENS,
  )("puts the pause button top right on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const { pause } = touchControlsLayout(viewport);

    expect(pause.x).toBeGreaterThan(size.width * 0.75);
    expect(pause.y + pause.h).toBeLessThan(size.height / 4);
    expect(pause.w).toBeCloseTo(44 * viewport.uiScale);
  });
});

describe("whether the touch controls show", () => {
  it("shows them while touch is the Active Input", () => {
    expect(touchControlsShown("touch", createMenus())).toBe(true);
  });

  it.each([
    "mouseAndKeyboard",
    "controller",
  ] as const)("hides them while %s is the Active Input", (way) => {
    expect(touchControlsShown(way, createMenus())).toBe(false);
  });

  it("hides them while a panel is open, as the Hero stands still", () => {
    const menus = { ...createMenus(), inventoryOpen: true };

    expect(touchControlsShown("touch", menus)).toBe(false);
  });

  it("hides them while paused", () => {
    const menus = createMenus();
    menus.pause.paused = true;

    expect(touchControlsShown("touch", menus)).toBe(false);
  });
});
