import { describe, expect, it } from "vitest";
import { createMenus, type Menus } from "../menus";
import { overlaps } from "../sim/rect";
import { viewportOf } from "../viewport";
import { mapAreaNameLayout } from "./mapMarks";
import {
  miniMapHitAt,
  miniMapLayout,
  miniMapScale,
  miniMapShown,
  miniMapTooltipRect,
} from "./miniMap";
import { panelButtonsLayout } from "./panelButtons";

const DESKTOP = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
];
const COMPACT = [
  { width: 800, height: 450 },
  { width: 667, height: 375 },
];

describe("the Mini Map's layout", () => {
  it("is 176 px square with a 12 px margin from the top right at UI Scale 1", () => {
    const rect = miniMapLayout(viewportOf({ width: 1280, height: 720 }));

    expect(rect).toEqual({ x: 1280 - 12 - 176, y: 12, w: 176, h: 176 });
  });

  it("grows with the UI Scale", () => {
    const screen = viewportOf({ width: 1920, height: 1080 });
    const rect = miniMapLayout(screen);

    expect(screen.uiScale).toBe(1.5);
    expect(rect).toEqual({ x: 1920 - 18 - 264, y: 18, w: 264, h: 264 });
  });

  it.each(
    DESKTOP,
  )("is square, on screen and clear of the Panel buttons at $width×$height", (size) => {
    const screen = viewportOf(size);
    const rect = miniMapLayout(screen);
    const { buttons, townPortal } = panelButtonsLayout(screen);

    expect(rect.w).toBe(rect.h);
    expect(rect.x + rect.w).toBeLessThanOrEqual(screen.width);
    for (const other of [...Object.values(buttons), townPortal]) {
      expect(overlaps(rect, other)).toBe(false);
    }
  });

  it.each(
    COMPACT,
  )("sits left of the Panel buttons' column, still at the top, at $width×$height", (size) => {
    const screen = viewportOf(size);
    const rect = miniMapLayout(screen);
    const { buttons, townPortal } = panelButtonsLayout(screen);

    expect(screen.compact).toBe(true);
    expect(rect.w).toBe(rect.h);
    expect(rect.y).toBe(12 * screen.uiScale);
    expect(rect.x + rect.w).toBeLessThan(buttons.hero.x);
    for (const other of [...Object.values(buttons), townPortal]) {
      expect(overlaps(rect, other)).toBe(false);
    }
  });

  it.each(
    COMPACT,
  )("is only 96 px square at UI Scale 1, to leave room for the pause button below it, at $width×$height", (size) => {
    const screen = viewportOf(size);

    expect(miniMapLayout(screen).w).toBe(96 * screen.uiScale);
  });

  it.each(
    COMPACT,
  )("leaves the Map Overlay's Area name left of the column at $width×$height", (size) => {
    const screen = viewportOf(size);
    const { buttons } = panelButtonsLayout(screen);

    expect(mapAreaNameLayout(screen).at.x).toBeLessThan(buttons.hero.x);
  });
});

describe("when the Mini Map shows", () => {
  const shownWith = (change: Partial<Menus>, heroDead = false) =>
    miniMapShown({ ...createMenus(), ...change }, heroDead);

  it("shows with nothing open", () => {
    expect(shownWith({})).toBe(true);
  });

  it("hides while the Map Overlay is open", () => {
    expect(shownWith({ mapOpen: true })).toBe(false);
  });

  it.each([
    "heroPanelOpen",
    "inventoryOpen",
    "skillTreeOpen",
  ] as const)("hides while a panel is open (%s)", (flag) => {
    expect(shownWith({ [flag]: true })).toBe(false);
  });

  it("hides during Death", () => {
    expect(shownWith({}, true)).toBe(false);
  });
});

describe("a click on the Mini Map", () => {
  const screen = viewportOf({ width: 1280, height: 720 });
  const rect = miniMapLayout(screen);

  it("hits the Mini Map inside its frame", () => {
    expect(miniMapHitAt(screen, { x: rect.x + 5, y: rect.y + 5 })).toEqual({
      button: { type: "miniMap" },
    });
  });

  it("is for the World off it", () => {
    expect(miniMapHitAt(screen, { x: rect.x - 1, y: rect.y + 5 })).toBeNull();
    expect(miniMapHitAt(screen, { x: rect.x + 5, y: rect.y + 177 })).toBeNull();
  });
});

describe("the Mini Map's tooltip", () => {
  it.each([
    ...DESKTOP,
    ...COMPACT,
  ])("sits under the Mini Map, on screen, at $width×$height", (size) => {
    const screen = viewportOf(size);
    const rect = miniMapLayout(screen);
    const tip = miniMapTooltipRect(screen, { w: 80, h: 24 }, 6);

    expect(tip.y).toBeGreaterThanOrEqual(rect.y + rect.h);
    expect(tip.x + tip.w).toBeLessThanOrEqual(screen.width);
  });
});

describe("the Mini Map's scale", () => {
  it.each([
    ...DESKTOP,
    ...COMPACT,
  ])("keeps its map in the same proportion to its frame at $width×$height", (size) => {
    const screen = viewportOf(size);
    const frame = miniMapLayout(screen).w;

    // Compact frames are smaller at the same UI Scale, so compare per UI Scale.
    expect(miniMapScale(screen) / screen.uiScale).toBe(0.14);
    expect(frame / screen.uiScale).toBe(screen.compact ? 96 : 176);
  });
});
