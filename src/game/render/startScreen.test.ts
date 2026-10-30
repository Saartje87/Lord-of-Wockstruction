import { describe, expect, it } from "vitest";
import { NO_FULLSCREEN } from "../fullscreen";
import { startScreen } from "../menus";
import type { Rect } from "../sim/rect";
import { viewportOf } from "../viewport";
import { startChoiceAt, startScreenLayout } from "./startScreen";

const screen = viewportOf({ width: 1280, height: 720 });
const keys = "mouseAndKeyboard";
const available = { available: true, on: false };

const centre = (rect: Rect) => ({
  x: rect.x + rect.w / 2,
  y: rect.y + rect.h / 2,
});

describe("the Start Screen's layout", () => {
  it("puts the buttons in a row, centred, under the game's name", () => {
    const { title, buttons } = startScreenLayout(
      screen,
      startScreen(true),
      keys,
      available,
    );

    expect(buttons.map((button) => button.choice)).toEqual([
      "continue",
      "newHero",
      "fullscreen",
    ]);
    const first = buttons[0].rect;
    const last = buttons[2].rect;
    expect((first.x + last.x + last.w) / 2).toBe(640);
    expect(new Set(buttons.map((button) => button.rect.y)).size).toBe(1);
    expect(title.at.x).toBe(640);
    expect(title.at.y).toBeLessThan(first.y);
  });

  it("closes the gap where Continue is hidden", () => {
    const { buttons } = startScreenLayout(
      screen,
      startScreen(false),
      keys,
      NO_FULLSCREEN,
    );

    expect(buttons.map((button) => button.choice)).toEqual(["newHero"]);
    expect(centre(buttons[0].rect).x).toBe(640);
  });

  it("shows Yes and No while confirming", () => {
    const { buttons } = startScreenLayout(
      screen,
      { ...startScreen(true), confirming: true },
      keys,
      available,
    );

    expect(buttons.map((button) => button.label)).toEqual([
      "Yes (Y)",
      "No (N)",
    ]);
  });

  it("labels the buttons with their keys", () => {
    const { buttons } = startScreenLayout(
      screen,
      startScreen(true),
      keys,
      available,
    );

    expect(buttons.map((button) => button.label)).toEqual([
      "Continue (C)",
      "New Hero (N)",
      "Fullscreen",
    ]);
  });

  it("is drawn at the UI Scale", () => {
    const tall = viewportOf({ width: 2560, height: 1440 });
    const small = startScreenLayout(screen, startScreen(true), keys, available);
    const big = startScreenLayout(tall, startScreen(true), keys, available);

    expect(big.buttons[0].rect.w / small.buttons[0].rect.w).toBeCloseTo(
      tall.uiScale / screen.uiScale,
    );
    expect(big.title.size / small.title.size).toBeCloseTo(
      tall.uiScale / screen.uiScale,
    );
  });

  it("fits on the smallest screen", () => {
    const smallest = viewportOf({ width: 640, height: 320 });
    const { title, buttons } = startScreenLayout(
      smallest,
      startScreen(true),
      "touch",
      available,
    );

    for (const { rect } of buttons) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(640);
      expect(rect.y + rect.h).toBeLessThanOrEqual(320);
    }
    expect(title.at.y - title.size / 2).toBeGreaterThanOrEqual(0);
    expect(title.at.y + title.size / 2).toBeLessThan(buttons[0].rect.y);
  });
});

describe("hit-testing the Start Screen", () => {
  const choiceAt = (rect: Rect, start = startScreen(true)) =>
    startChoiceAt(screen, centre(rect), start, keys, available);

  it("finds the button under a click", () => {
    const { buttons } = startScreenLayout(
      screen,
      startScreen(true),
      keys,
      available,
    );

    expect(buttons.map((button) => choiceAt(button.rect))).toEqual([
      "continue",
      "newHero",
      "fullscreen",
    ]);
  });

  it("finds nothing off the buttons, nor where a hidden one would be", () => {
    const { buttons } = startScreenLayout(
      screen,
      startScreen(true),
      keys,
      available,
    );

    expect(choiceAt({ x: 0, y: 0, w: 10, h: 10 })).toBeNull();
    expect(choiceAt(buttons[0].rect, startScreen(false))).not.toBe("continue");
  });

  it("finds no Fullscreen button where the browser forbids it", () => {
    const { buttons } = startScreenLayout(
      screen,
      startScreen(true),
      keys,
      available,
    );

    expect(
      startChoiceAt(
        screen,
        centre(buttons[2].rect),
        startScreen(true),
        keys,
        NO_FULLSCREEN,
      ),
    ).toBeNull();
  });
});

describe("touching the Start Screen", () => {
  const { buttons } = startScreenLayout(
    screen,
    startScreen(true),
    "touch",
    available,
  );
  const [continueButton, newHero] = buttons;
  const touchAt = (point: { x: number; y: number }) =>
    startChoiceAt(screen, point, startScreen(true), "touch", available);
  const clickAt = (point: { x: number; y: number }) =>
    startChoiceAt(screen, point, startScreen(true), keys, available);

  it("grows each button's hit area toward a fingertip, for a touch only", () => {
    const { x, y, w } = continueButton.rect;
    const justAbove = { x: x + w / 2, y: y - 5 };

    expect(touchAt(justAbove)).toBe("continue");
    expect(clickAt(justAbove)).toBeNull();
  });

  it("stops halfway to the next button, so a touch between goes to the nearer", () => {
    const y = continueButton.rect.y + 10;
    const gapStart = continueButton.rect.x + continueButton.rect.w;
    const gapEnd = newHero.rect.x;
    const middle = (gapStart + gapEnd) / 2;

    expect(touchAt({ x: middle - 1, y })).toBeNull();
    expect(touchAt({ x: gapStart + 1, y })).toBeNull();
  });
});
