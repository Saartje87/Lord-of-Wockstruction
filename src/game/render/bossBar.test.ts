import { describe, expect, it } from "vitest";
import { overlaps, type Rect } from "../sim/rect";
import { viewportOf } from "../viewport";
import { ACT_COMPLETE_BANNER } from "./actCompleteBanner";
import { AREA_BANNER } from "./areaBanner";
import { BOSS_BAR, bossBarContentOf, bossBarLayout } from "./bossBar";
import { nameplateLayout } from "./hover";

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 1180, height: 820 },
  { width: 667, height: 375 },
  { width: 640, height: 320 },
];

/** The rectangle a centred banner's text takes up, stroke included. */
function bannerRect(
  screen: { width: number; height: number; uiScale: number },
  banner: { size: number; stroke: number; top: number },
): Rect {
  const half = (banner.size / 2 + banner.stroke) * screen.uiScale;
  const y = Math.round(screen.height * banner.top);
  return { x: 0, y: y - half, w: screen.width, h: half * 2 };
}

describe("the Boss bar's content", () => {
  it("shows the name with the Life bar's fill", () => {
    expect(
      bossBarContentOf({ name: "Grave Wockington", life: 30, maxLife: 120 }),
    ).toEqual({ name: "Grave Wockington", fraction: 0.25 });
  });

  it("shows nothing without an Act Boss In Combat", () => {
    expect(bossBarContentOf(null)).toBeNull();
  });
});

describe("the Boss bar's layout", () => {
  it.each(
    SIZES,
  )("is centred across the top at the UI Scale on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const { panel, bar, nameAt, nameSize } = bossBarLayout(viewport);

    expect(panel.x + panel.w / 2).toBeCloseTo(size.width / 2);
    expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.w).toBeLessThanOrEqual(size.width);
    expect(nameSize).toBeCloseTo(BOSS_BAR.nameSize * viewport.uiScale);
    expect(panel.h).toBeCloseTo(BOSS_BAR.height * viewport.uiScale);
    // The name and Life bar inside the panel, the name over the bar.
    for (const rect of [bar, { ...nameAt, w: 0, h: nameSize }]) {
      expect(rect.x).toBeGreaterThanOrEqual(panel.x);
      expect(rect.x + rect.w).toBeLessThanOrEqual(panel.x + panel.w);
      expect(rect.y).toBeGreaterThanOrEqual(panel.y);
      expect(rect.y + rect.h).toBeLessThanOrEqual(panel.y + panel.h);
    }
    expect(nameAt.y + nameSize).toBeLessThanOrEqual(bar.y);
  });

  it("is 360 px wide at native scale on a desktop", () => {
    const desktop = viewportOf({ width: 1280, height: 720 });

    expect(bossBarLayout(desktop).panel.w).toBeCloseTo(
      BOSS_BAR.width * desktop.uiScale,
    );
  });

  it.each(
    SIZES,
  )("marks half its Life in the middle of the bar on $width×$height", (size) => {
    const { bar, mark } = bossBarLayout(viewportOf(size));

    expect(mark.x + mark.w / 2).toBeCloseTo(bar.x + bar.w / 2);
    expect(mark.y).toBeLessThanOrEqual(bar.y);
    expect(mark.y + mark.h).toBeGreaterThanOrEqual(bar.y + bar.h);
  });

  it.each(
    SIZES,
  )("keeps clear of the Area Banner and the Act Complete banner on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const { panel } = bossBarLayout(viewport);

    expect(overlaps(panel, bannerRect(viewport, AREA_BANNER))).toBe(false);
    expect(overlaps(panel, bannerRect(viewport, ACT_COMPLETE_BANNER))).toBe(
      false,
    );
  });

  it.each(
    SIZES,
  )("pushes the hover nameplate below it on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const { panel } = bossBarLayout(viewport);

    const plate = nameplateLayout(viewport, panel.y + panel.h);

    expect(overlaps(panel, plate.panel)).toBe(false);
  });
});
