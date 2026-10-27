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

describe("the viewport's World zoom", () => {
  it.each([
    // At the reference height, the World is drawn at native size.
    { screen: "1280×720", width: 1280, height: 720, worldZoom: 1 },
    {
      screen: "a 1180×820 tablet",
      width: 1180,
      height: 820,
      worldZoom: 820 / 720,
    },
    { screen: "1920×1080", width: 1920, height: 1080, worldZoom: 1.5 },
    { screen: "2560×1440", width: 2560, height: 1440, worldZoom: 2 },
    { screen: "a 640×360 phone", width: 640, height: 360, worldZoom: 0.5 },
    // 3 by height, held to the upper limit.
    { screen: "a 3840×2160 screen", width: 3840, height: 2160, worldZoom: 2 },
    // 300 / 720 by height, held to the lower limit.
    { screen: "below the minimum", width: 500, height: 300, worldZoom: 0.5 },
  ])("follows the screen's height on $screen", ({
    width,
    height,
    worldZoom,
  }) => {
    expect(viewportOf({ width, height }).worldZoom).toBeCloseTo(worldZoom);
  });
});

describe("the viewport's Compact Layout", () => {
  it.each([
    { screen: "a 640×360 phone", width: 640, height: 360, compact: true },
    { screen: "an 844×390 phone", width: 844, height: 390, compact: true },
    { screen: "a 1024×539 window", width: 1024, height: 539, compact: true },
    { screen: "a 1024×540 window", width: 1024, height: 540, compact: false },
    { screen: "1280×720", width: 1280, height: 720, compact: false },
    { screen: "a 1180×820 tablet", width: 1180, height: 820, compact: false },
    { screen: "1920×1080", width: 1920, height: 1080, compact: false },
  ])("applies below 540 px tall: $screen", ({ width, height, compact }) => {
    expect(viewportOf({ width, height }).compact).toBe(compact);
  });
});

describe("the viewport's Rotate Notice", () => {
  it.each([
    { screen: "a 640×360 phone", width: 640, height: 360, notice: null },
    { screen: "a 640×320 window", width: 640, height: 320, notice: null },
    {
      screen: "a Pixel 7a sideways in Chrome",
      width: 915,
      height: 330,
      notice: null,
    },
    { screen: "an 844×390 phone", width: 844, height: 390, notice: null },
    { screen: "a 1180×820 tablet", width: 1180, height: 820, notice: null },
    { screen: "1920×1080", width: 1920, height: 1080, notice: null },
    { screen: "2560×1440", width: 2560, height: 1440, notice: null },
    // Square is not taller than wide.
    { screen: "a 700×700 window", width: 700, height: 700, notice: null },
    { screen: "a phone held upright", width: 390, height: 844, notice: "turn" },
    { screen: "a tablet upright", width: 820, height: 1180, notice: "turn" },
    { screen: "a 700×701 window", width: 700, height: 701, notice: "turn" },
    { screen: "a 639×320 window", width: 639, height: 320, notice: "enlarge" },
    { screen: "a 640×319 window", width: 640, height: 319, notice: "enlarge" },
    { screen: "below the minimum", width: 500, height: 300, notice: "enlarge" },
    // Upright and small too: turning it sideways is what helps first.
    { screen: "a 300×500 window", width: 300, height: 500, notice: "turn" },
  ])("on $screen: $notice", ({ width, height, notice }) => {
    expect(viewportOf({ width, height }).rotateNotice).toBe(notice);
  });
});
