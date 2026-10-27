import { describe, expect, it } from "vitest";
import { fullscreenAvailable, fullscreenPointerEvent } from "./fullscreen";

describe("the pointer event that may ask for fullscreen", () => {
  it("is the press for a mouse, which lets the page go fullscreen", () => {
    expect(fullscreenPointerEvent("mouse")).toBe("pointerdown");
  });

  it.each([
    "touch",
    "pen",
  ])("is the lift for a %s, as only the lift lets the page go fullscreen", (pointerType) => {
    expect(fullscreenPointerEvent(pointerType)).toBe("pointerup");
  });
});

describe("whether fullscreen is available", () => {
  it("is in a browser tab that allows it", () => {
    expect(fullscreenAvailable({ allowed: true, installed: false })).toBe(true);
  });

  it("isn't in the Installed game, with no browser around it to remove", () => {
    expect(fullscreenAvailable({ allowed: true, installed: true })).toBe(false);
  });

  it.each([
    false,
    true,
  ])("isn't where the browser doesn't allow it (Installed: %s)", (installed) => {
    expect(fullscreenAvailable({ allowed: false, installed })).toBe(false);
  });
});
