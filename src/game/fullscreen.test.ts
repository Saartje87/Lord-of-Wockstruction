import { describe, expect, it } from "vitest";
import { fullscreenPointerEvent } from "./fullscreen";

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
