import { describe, expect, it } from "vitest";
import { viewportOf } from "./viewport";

describe("the viewport's UI Scale", () => {
  it.each([
    // At the reference height, the HUD is drawn at native scale.
    { screen: "1280×720", width: 1280, height: 720, uiScale: 1 },
    {
      screen: "a 1180×820 tablet",
      width: 1180,
      height: 820,
      uiScale: 820 / 720,
    },
    { screen: "1920×1080", width: 1920, height: 1080, uiScale: 1.5 },
    // 2 by height, held to the upper limit.
    { screen: "2560×1440", width: 2560, height: 1440, uiScale: 1.5 },
    // 0.5 by height, held to the lower limit.
    { screen: "a 640×360 phone", width: 640, height: 360, uiScale: 0.75 },
    { screen: "below the minimum", width: 500, height: 300, uiScale: 0.75 },
    {
      screen: "a phone held upright",
      width: 390,
      height: 844,
      uiScale: 844 / 720,
    },
  ])("follows the screen's height on $screen", ({ width, height, uiScale }) => {
    const viewport = viewportOf({ width, height });

    expect(viewport.uiScale).toBeCloseTo(uiScale);
    expect(viewport.width).toBe(width);
    expect(viewport.height).toBe(height);
  });
});
