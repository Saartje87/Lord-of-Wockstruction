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
  it("offer a New Hero, in the middle of the screen", () => {
    const { buttons } = pauseMenuLayout(
      screen,
      false,
      keys,
      NO_FULLSCREEN,
      false,
    );

    expect(buttons.map((button) => button.choice)).toEqual([
      "newHero",
      "world3d",
    ]);
    expect(centre(buttons[0].rect).x).toBe(640);
  });

  it("offer Yes and No while asking to confirm", () => {
    const { buttons } = pauseMenuLayout(
      screen,
      true,
      keys,
      NO_FULLSCREEN,
      false,
    );

    expect(buttons.map((button) => button.choice)).toEqual([
      "confirm",
      "goBack",
    ]);
  });

  it("are labelled with their keys, or for the controller with B on No", () => {
    const labels = (
      confirming: boolean,
      way: "mouseAndKeyboard" | "controller" = keys,
    ) =>
      pauseMenuLayout(
        screen,
        confirming,
        way,
        NO_FULLSCREEN,
        false,
      ).buttons.map((b) => b.label);

    expect(labels(false)).toEqual(["New Hero (N)", "3D World (beta): Off"]);
    expect(labels(true)).toEqual(["Yes (Y)", "No (N)"]);
    expect(labels(true, "controller")).toEqual(["Yes", "No (B)"]);
  });

  it("are found under a click", () => {
    const choiceAt = (rect: Rect, confirming: boolean) =>
      menuChoiceAt(
        screen,
        centre(rect),
        confirming,
        keys,
        NO_FULLSCREEN,
        false,
      );
    const [newHero] = pauseMenuLayout(
      screen,
      false,
      keys,
      NO_FULLSCREEN,
      false,
    ).buttons;
    const [yes, no] = pauseMenuLayout(
      screen,
      true,
      keys,
      NO_FULLSCREEN,
      false,
    ).buttons;

    expect(choiceAt(newHero.rect, false)).toBe("newHero");
    expect(choiceAt(yes.rect, true)).toBe("confirm");
    expect(choiceAt(no.rect, true)).toBe("goBack");
  });

  it("find nothing off them, nor where a hidden one would be", () => {
    const choiceAt = (rect: Rect, confirming: boolean) =>
      menuChoiceAt(
        screen,
        centre(rect),
        confirming,
        keys,
        NO_FULLSCREEN,
        false,
      );
    const [newHero] = pauseMenuLayout(
      screen,
      false,
      keys,
      NO_FULLSCREEN,
      false,
    ).buttons;
    const [yes] = pauseMenuLayout(
      screen,
      true,
      keys,
      NO_FULLSCREEN,
      false,
    ).buttons;
    const corner = { x: 0, y: 0, w: 20, h: 20 };

    expect(choiceAt(corner, false)).toBeNull();
    expect(choiceAt(yes.rect, false)).not.toBe("confirm");
    expect(choiceAt(newHero.rect, true)).not.toBe("newHero");
  });
});

describe("the pause menu's Fullscreen button", () => {
  const available = { available: true, on: false };
  const on = { available: true, on: true };
  const unavailable = { available: false, on: false };

  it("sits beside New Hero where the browser allows fullscreen", () => {
    const { buttons } = pauseMenuLayout(screen, false, keys, available, false);

    expect(buttons.map((button) => button.choice)).toEqual([
      "newHero",
      "fullscreen",
      "world3d",
    ]);
  });

  it("isn't shown where the browser doesn't allow fullscreen", () => {
    const { buttons } = pauseMenuLayout(
      screen,
      false,
      keys,
      unavailable,
      false,
    );

    expect(buttons.map((button) => button.choice)).toEqual([
      "newHero",
      "world3d",
    ]);
  });

  it.each([
    "mouseAndKeyboard",
    "touch",
    "controller",
  ] as const)("reads Fullscreen, or Exit fullscreen while fullscreen (%s)", (way) => {
    const label = (fullscreen: typeof on) =>
      pauseMenuLayout(screen, false, way, fullscreen, false).buttons[1].label;

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
      false,
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
      keys,
      available,
      false,
    ).buttons;
    const at = centre(fullscreen.rect);

    expect(menuChoiceAt(screen, at, false, keys, available, false)).toBe(
      "fullscreen",
    );
    expect(
      menuChoiceAt(screen, at, false, keys, unavailable, false),
    ).toBeNull();
    expect(menuChoiceAt(screen, at, true, keys, available, false)).not.toBe(
      "fullscreen",
    );
  });

  it("is hidden while confirming a New Hero, as New Hero is", () => {
    const { buttons } = pauseMenuLayout(screen, true, keys, available, false);

    expect(buttons.map((button) => button.choice)).toEqual([
      "confirm",
      "goBack",
    ]);
  });
});

describe("the pause menu's 3D World (beta) button", () => {
  const available = { available: true, on: false };

  it.each([
    "mouseAndKeyboard",
    "touch",
    "controller",
  ] as const)("reads On or Off as the 3D World is drawn or not (%s)", (way) => {
    const label = (world3d: boolean) =>
      pauseMenuLayout(screen, false, way, NO_FULLSCREEN, world3d).buttons.find(
        (button) => button.choice === "world3d",
      )?.label;

    expect(label(false)).toBe("3D World (beta): Off");
    expect(label(true)).toBe("3D World (beta): On");
  });

  it("sits on a row of its own, in the middle, clear of the others", () => {
    const { panel, buttons } = pauseMenuLayout(
      screen,
      false,
      keys,
      available,
      false,
    );
    const [newHero, fullscreen, world3d] = buttons;

    expect(world3d.choice).toBe("world3d");
    expect(world3d.rect.y).toBeGreaterThan(newHero.rect.y + newHero.rect.h);
    expect(world3d.rect.y).toBeGreaterThan(
      fullscreen.rect.y + fullscreen.rect.h,
    );
    expect(centre(world3d.rect).x).toBe(centre(panel).x);
  });

  it("fits in the panel, and on the smallest screen", () => {
    const smallest = viewportOf({ width: 640, height: 320 });
    for (const [view, way] of [
      [screen, keys],
      [smallest, "touch"],
    ] as const) {
      const { panel, buttons } = pauseMenuLayout(
        view,
        false,
        way,
        available,
        false,
      );
      const { rect } = buttons[2];
      expect(rect.x).toBeGreaterThanOrEqual(panel.x);
      expect(rect.x + rect.w).toBeLessThanOrEqual(panel.x + panel.w);
      expect(rect.y + rect.h).toBeLessThanOrEqual(panel.y + panel.h);
      expect(panel.y).toBeGreaterThanOrEqual(0);
      expect(panel.y + panel.h).toBeLessThanOrEqual(view.height);
    }
  });

  it("is found under a click or tap, but not while confirming a New Hero", () => {
    const [, world3d] = pauseMenuLayout(
      screen,
      false,
      keys,
      NO_FULLSCREEN,
      false,
    ).buttons;
    const at = centre(world3d.rect);

    expect(menuChoiceAt(screen, at, false, keys, NO_FULLSCREEN, false)).toBe(
      "world3d",
    );
    expect(menuChoiceAt(screen, at, true, keys, NO_FULLSCREEN, false)).not.toBe(
      "world3d",
    );
  });
});
