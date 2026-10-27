import { describe, expect, it } from "vitest";
import type { Rect } from "../sim/rect";
import { viewportOf } from "../viewport";
import { menuChoiceAt, pauseMenuLayout } from "./pauseMenu";

const screen = viewportOf({ width: 1280, height: 720 });

const centre = (rect: Rect) => ({
  x: rect.x + rect.w / 2,
  y: rect.y + rect.h / 2,
});

describe("the pause menu's buttons", () => {
  it("offer a New Hero, in the middle of the screen", () => {
    const { buttons } = pauseMenuLayout(screen, false);

    expect(buttons.map((button) => button.choice)).toEqual(["newHero"]);
    expect(centre(buttons[0].rect).x).toBe(640);
  });

  it("offer Yes and No while asking to confirm", () => {
    const { buttons } = pauseMenuLayout(screen, true);

    expect(buttons.map((button) => button.choice)).toEqual([
      "confirm",
      "goBack",
    ]);
  });

  it("are labelled with their keys, or for the controller with B on No", () => {
    const labels = (confirming: boolean, way?: "controller") =>
      pauseMenuLayout(screen, confirming, way).buttons.map((b) => b.label);

    expect(labels(false)).toEqual(["New Hero (N)"]);
    expect(labels(true)).toEqual(["Yes (Y)", "No (N)"]);
    expect(labels(true, "controller")).toEqual(["Yes", "No (B)"]);
  });

  it("are found under a click", () => {
    const [newHero] = pauseMenuLayout(screen, false).buttons;
    const [yes, no] = pauseMenuLayout(screen, true).buttons;

    expect(menuChoiceAt(screen, centre(newHero.rect), false)).toBe("newHero");
    expect(menuChoiceAt(screen, centre(yes.rect), true)).toBe("confirm");
    expect(menuChoiceAt(screen, centre(no.rect), true)).toBe("goBack");
  });

  it("find nothing off them, nor where a hidden one would be", () => {
    const [newHero] = pauseMenuLayout(screen, false).buttons;
    const [yes] = pauseMenuLayout(screen, true).buttons;

    expect(menuChoiceAt(screen, { x: 10, y: 10 }, false)).toBeNull();
    expect(menuChoiceAt(screen, centre(yes.rect), false)).not.toBe("confirm");
    expect(menuChoiceAt(screen, centre(newHero.rect), true)).not.toBe(
      "newHero",
    );
  });
});

describe("the pause menu's Fullscreen button", () => {
  const available = { available: true, on: false };
  const on = { available: true, on: true };
  const unavailable = { available: false, on: false };

  it("sits beside New Hero where the browser allows fullscreen", () => {
    const { buttons } = pauseMenuLayout(screen, false, undefined, available);

    expect(buttons.map((button) => button.choice)).toEqual([
      "newHero",
      "fullscreen",
    ]);
  });

  it("isn't shown where the browser doesn't allow fullscreen", () => {
    const { buttons } = pauseMenuLayout(screen, false, undefined, unavailable);

    expect(buttons.map((button) => button.choice)).toEqual(["newHero"]);
  });

  it.each([
    "mouseAndKeyboard",
    "touch",
    "controller",
  ] as const)("reads Fullscreen, or Exit fullscreen while fullscreen (%s)", (way) => {
    const label = (fullscreen: typeof on) =>
      pauseMenuLayout(screen, false, way, fullscreen).buttons[1].label;

    expect(label(available)).toBe("Fullscreen");
    expect(label(on)).toBe("Exit fullscreen");
  });

  it("fits on the smallest screen, clear of New Hero", () => {
    const smallest = viewportOf({ width: 640, height: 320 });
    const [newHero, fullscreen] = pauseMenuLayout(
      smallest,
      false,
      "touch",
      available,
    ).buttons;

    expect(fullscreen.rect.x).toBeGreaterThanOrEqual(0);
    expect(fullscreen.rect.y).toBeGreaterThanOrEqual(0);
    expect(fullscreen.rect.x + fullscreen.rect.w).toBeLessThanOrEqual(640);
    expect(fullscreen.rect.y + fullscreen.rect.h).toBeLessThanOrEqual(320);
    expect(newHero.rect.x + newHero.rect.w).toBeLessThan(fullscreen.rect.x);
  });

  it("is found under a click or tap, but not where the browser forbids it", () => {
    const [, fullscreen] = pauseMenuLayout(
      screen,
      false,
      undefined,
      available,
    ).buttons;
    const at = centre(fullscreen.rect);

    expect(menuChoiceAt(screen, at, false, available)).toBe("fullscreen");
    expect(menuChoiceAt(screen, at, false, unavailable)).toBeNull();
    expect(menuChoiceAt(screen, at, true, available)).not.toBe("fullscreen");
  });

  it("is hidden while confirming a New Hero, as New Hero is", () => {
    const { buttons } = pauseMenuLayout(screen, true, undefined, available);

    expect(buttons.map((button) => button.choice)).toEqual([
      "confirm",
      "goBack",
    ]);
  });
});
