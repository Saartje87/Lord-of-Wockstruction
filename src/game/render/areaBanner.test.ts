import { describe, expect, it } from "vitest";
import { areaTuning } from "../tuning/areas";
import { viewportOf } from "../viewport";
import {
  areaBannerLayout,
  arrivedInDisplayName,
  bannerOpacityAt,
} from "./areaBanner";

const NAMES = { town: "Town", catacombs: "Catacombs" };

describe("arrivedInDisplayName", () => {
  it("shows the display name of the Area the Hero arrived in", () => {
    expect(
      arrivedInDisplayName(
        [{ type: "AreaChanged", area: "catacombs", entry: "start" }],
        NAMES,
      ),
    ).toBe("Catacombs");
  });

  it("shows Town too, on arriving there after a Death", () => {
    expect(
      arrivedInDisplayName(
        [
          { type: "HeroDied" },
          { type: "AreaChanged", area: "town", entry: "start" },
        ],
        NAMES,
      ),
    ).toBe("Town");
  });

  it("shows nothing for a step the Hero arrived nowhere", () => {
    expect(
      arrivedInDisplayName(
        [{ type: "HeroHit", damage: 6, warded: 0, damageType: "physical" }],
        NAMES,
      ),
    ).toBeNull();
  });
});

describe("the Area Banner's layout", () => {
  it.each([
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 1180, height: 820 },
  ])("is centred near the top at the UI Scale on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const banner = areaBannerLayout(viewport);

    expect(banner.at.x).toBe(size.width / 2);
    expect(banner.at.y).toBeCloseTo(0.22 * size.height, 0);
    // 34 px text in a 4 px outline at native scale.
    expect(banner.size).toBeCloseTo(34 * viewport.uiScale);
    expect(banner.stroke).toBeCloseTo(4 * viewport.uiScale);
  });
});

describe("bannerOpacityAt", () => {
  const { bannerFadeInMs, bannerHoldMs, bannerFadeOutMs } = areaTuning;

  it("fades in from nothing", () => {
    expect(bannerOpacityAt(0)).toBe(0);
    expect(bannerOpacityAt(bannerFadeInMs / 2)).toBeCloseTo(0.5);
  });

  it("holds fully opaque", () => {
    expect(bannerOpacityAt(bannerFadeInMs)).toBe(1);
    expect(bannerOpacityAt(bannerFadeInMs + bannerHoldMs)).toBe(1);
  });

  it("fades out and then is gone", () => {
    const fadingOut = bannerFadeInMs + bannerHoldMs;
    expect(bannerOpacityAt(fadingOut + bannerFadeOutMs / 2)).toBeCloseTo(0.5);
    expect(bannerOpacityAt(fadingOut + bannerFadeOutMs)).toBeNull();
  });
});
