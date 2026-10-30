import { describe, expect, it } from "vitest";
import { areaTuning } from "../tuning/areas";
import { viewportOf } from "../viewport";
import {
  actCompletedText,
  actCompleteLayout,
  actCompleteOpacityAt,
} from "./actCompleteBanner";
import { AREA_BANNER, areaBannerLayout } from "./areaBanner";

describe("actCompletedText", () => {
  it("says Act I Complete for the completion of Act 1", () => {
    expect(
      actCompletedText([
        { type: "MonsterDied", id: 3 },
        { type: "ActCompleted", act: 1 },
      ]),
    ).toBe("Act I Complete");
  });

  it("writes later Acts in Roman numerals", () => {
    expect(actCompletedText([{ type: "ActCompleted", act: 2 }])).toBe(
      "Act II Complete",
    );
    expect(actCompletedText([{ type: "ActCompleted", act: 4 }])).toBe(
      "Act IV Complete",
    );
  });

  it("shows nothing for a step that completed no Act", () => {
    expect(actCompletedText([{ type: "MonsterDied", id: 3 }])).toBeNull();
  });
});

describe("the Act Complete banner's layout", () => {
  it.each([
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 1180, height: 820 },
  ])("is centred, bigger than the Area Banner, on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const banner = actCompleteLayout(viewport);

    expect(banner.at.x).toBe(size.width / 2);
    expect(banner.size).toBeCloseTo(76 * viewport.uiScale);
    expect(banner.size).toBeGreaterThan(areaBannerLayout(viewport).size);
    expect(banner.stroke).toBeGreaterThan(areaBannerLayout(viewport).stroke);
    // Lower than the Area Banner, which may be showing at the same time.
    expect(banner.at.y).toBeGreaterThan(size.height * AREA_BANNER.top);
  });

  it("fits its text across a phone's width", () => {
    const viewport = viewportOf({ width: 667, height: 375 });
    const banner = actCompleteLayout(viewport);

    // "Act I Complete" is 14 characters, about 0.6 of the text size wide each.
    expect(14 * 0.6 * banner.size).toBeLessThan(viewport.width);
  });
});

describe("actCompleteOpacityAt", () => {
  const { actBannerFadeInMs, actBannerHoldMs, actBannerFadeOutMs } = areaTuning;

  it("fades in from nothing", () => {
    expect(actCompleteOpacityAt(0)).toBe(0);
    expect(actCompleteOpacityAt(actBannerFadeInMs / 2)).toBeCloseTo(0.5);
  });

  it("holds fully opaque, longer than the Area Banner", () => {
    expect(actCompleteOpacityAt(actBannerFadeInMs)).toBe(1);
    expect(actCompleteOpacityAt(actBannerFadeInMs + actBannerHoldMs)).toBe(1);
    expect(actBannerHoldMs).toBeGreaterThan(areaTuning.bannerHoldMs);
  });

  it("fades out and then is gone", () => {
    const fadingOut = actBannerFadeInMs + actBannerHoldMs;
    expect(
      actCompleteOpacityAt(fadingOut + actBannerFadeOutMs / 2),
    ).toBeCloseTo(0.5);
    expect(actCompleteOpacityAt(fadingOut + actBannerFadeOutMs)).toBeNull();
  });
});
