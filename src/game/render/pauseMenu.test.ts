import { describe, expect, it } from "vitest";
import { NO_FULLSCREEN } from "../fullscreen";
import type { Rect } from "../sim/rect";
import { viewportOf } from "../viewport";
import { menuChoiceAt, pauseMenuLayout } from "./pauseMenu";

const screen = viewportOf({ width: 1280, height: 720 });
const keys = "mouseAndKeyboard";

const centre = (rect: Rect) => ({
  x: rect.x + rect.w / 2,
  y: rect.y + rect.h / 2,
});

describe("the pause menu's buttons", () => {
  it("offer Quit to Start Screen and no New Hero, in the middle of the screen", () => {
    const { buttons } = pauseMenuLayout(screen, keys, NO_FULLSCREEN);

    expect(buttons.map((button) => button.choice)).toEqual(["quit"]);
    expect(centre(buttons[0].rect).x).toBe(640);
  });

  it("are labelled with their keys, or bare for the controller and touch", () => {
    const labels = (way: "mouseAndKeyboard" | "controller" | "touch") =>
      pauseMenuLayout(screen, way, NO_FULLSCREEN).buttons.map((b) => b.label);

    expect(labels(keys)).toEqual(["Quit to Start Screen (Q)"]);
    expect(labels("controller")).toEqual(["Quit to Start Screen"]);
    expect(labels("touch")).toEqual(["Quit to Start Screen"]);
  });

  it("are found under a click", () => {
    const [quit] = pauseMenuLayout(screen, keys, NO_FULLSCREEN).buttons;

    expect(menuChoiceAt(screen, centre(quit.rect), keys, NO_FULLSCREEN)).toBe(
      "quit",
    );
  });

  it("find nothing off them", () => {
    const corner = { x: 0, y: 0, w: 20, h: 20 };

    expect(
      menuChoiceAt(screen, centre(corner), keys, NO_FULLSCREEN),
    ).toBeNull();
  });
});

describe("the pause menu's Fullscreen button", () => {
  const available = { available: true, on: false };
  const on = { available: true, on: true };
  const unavailable = { available: false, on: false };

  it("sits beside Quit to Start Screen where the browser allows fullscreen", () => {
    const { buttons } = pauseMenuLayout(screen, keys, available);

    expect(buttons.map((button) => button.choice)).toEqual([
      "quit",
      "fullscreen",
    ]);
  });

  it("isn't shown where the browser doesn't allow fullscreen", () => {
    const { buttons } = pauseMenuLayout(screen, keys, unavailable);

    expect(buttons.map((button) => button.choice)).toEqual(["quit"]);
  });

  it.each([
    "mouseAndKeyboard",
    "touch",
    "controller",
  ] as const)("reads Fullscreen, or Exit fullscreen while fullscreen (%s)", (way) => {
    const label = (fullscreen: typeof on) =>
      pauseMenuLayout(screen, way, fullscreen).buttons[1].label;

    expect(label(available)).toBe("Fullscreen");
    expect(label(on)).toBe("Exit fullscreen");
  });

  it("fits the row on the smallest screen, clear of Quit to Start Screen", () => {
    const smallest = viewportOf({ width: 640, height: 320 });
    const { panel, buttons } = pauseMenuLayout(smallest, "touch", available);
    const [quit, fullscreen] = buttons;

    for (const { rect } of buttons) {
      expect(rect.x).toBeGreaterThanOrEqual(panel.x);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(panel.x + panel.w);
      expect(rect.x + rect.w).toBeLessThanOrEqual(640);
      expect(rect.y + rect.h).toBeLessThanOrEqual(320);
    }
    expect(quit.rect.x + quit.rect.w).toBeLessThan(fullscreen.rect.x);
  });

  it("is found under a click or tap, but not where the browser forbids it", () => {
    const [, fullscreen] = pauseMenuLayout(screen, keys, available).buttons;
    const at = centre(fullscreen.rect);

    expect(menuChoiceAt(screen, at, keys, available)).toBe("fullscreen");
    expect(menuChoiceAt(screen, at, keys, unavailable)).toBeNull();
  });
});
