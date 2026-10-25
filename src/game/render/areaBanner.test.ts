import { describe, expect, it } from "vitest";
import { areaTuning } from "../tuning/areas";
import { areaBanner, bannerAt } from "./areaBanner";

const NAMES = { town: "Town", catacombs: "Catacombs" };

describe("areaBanner", () => {
  it("shows the display name of the Area the Hero arrived in", () => {
    expect(
      areaBanner(
        [{ type: "AreaChanged", area: "catacombs", entry: "start" }],
        NAMES,
      ),
    ).toBe("Catacombs");
  });

  it("shows Town too, on arriving there after a Death", () => {
    expect(
      areaBanner(
        [
          { type: "HeroDied" },
          { type: "AreaChanged", area: "town", entry: "start" },
        ],
        NAMES,
      ),
    ).toBe("Town");
  });

  it("shows nothing for a step the Hero arrived nowhere", () => {
    expect(areaBanner([{ type: "HeroHit", damage: 6 }], NAMES)).toBeNull();
  });
});

describe("bannerAt", () => {
  const { bannerFadeInMs, bannerHoldMs, bannerFadeOutMs } = areaTuning;

  it("fades in from nothing", () => {
    expect(bannerAt(0)).toBe(0);
    expect(bannerAt(bannerFadeInMs / 2)).toBeCloseTo(0.5);
  });

  it("holds fully opaque", () => {
    expect(bannerAt(bannerFadeInMs)).toBe(1);
    expect(bannerAt(bannerFadeInMs + bannerHoldMs)).toBe(1);
  });

  it("fades out and then is gone", () => {
    const fadingOut = bannerFadeInMs + bannerHoldMs;
    expect(bannerAt(fadingOut + bannerFadeOutMs / 2)).toBeCloseTo(0.5);
    expect(bannerAt(fadingOut + bannerFadeOutMs)).toBeNull();
  });
});
