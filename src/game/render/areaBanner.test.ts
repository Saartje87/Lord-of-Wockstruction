import { describe, expect, it } from "vitest";
import { areaTuning } from "../tuning/areas";
import { arrivedInDisplayName, bannerOpacityAt } from "./areaBanner";

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
      arrivedInDisplayName([{ type: "HeroHit", damage: 6 }], NAMES),
    ).toBeNull();
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
