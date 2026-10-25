import { describe, expect, it } from "vitest";
import { createPause, gameTime, pressKey, togglePause } from "./pause";

describe("pause", () => {
  it("runs game time with real time until paused", () => {
    const pause = createPause();

    expect(gameTime(pause, 1000)).toBe(1000);
    expect(pause.paused).toBe(false);
  });

  it("stops game time while paused", () => {
    const pause = createPause();

    togglePause(pause, 1000);

    expect(pause.paused).toBe(true);
    expect(gameTime(pause, 1000)).toBe(1000);
    expect(gameTime(pause, 61_000)).toBe(1000);
  });

  it("resumes from where it stopped, skipping the time spent paused", () => {
    const pause = createPause();
    togglePause(pause, 1000);

    togglePause(pause, 61_000);

    expect(pause.paused).toBe(false);
    expect(gameTime(pause, 61_000)).toBe(1000);
    expect(gameTime(pause, 61_016)).toBe(1016);
  });

  it("adds up several pauses", () => {
    const pause = createPause();
    togglePause(pause, 1000);
    togglePause(pause, 2000);
    togglePause(pause, 3000);
    togglePause(pause, 5000);

    expect(gameTime(pause, 6000)).toBe(3000);
  });
});

describe("the pause menu's keys", () => {
  it("open and close the menu with Esc", () => {
    const pause = createPause();

    expect(pressKey(pause, "Escape", 1000)).toBeNull();
    expect(pause.paused).toBe(true);
    pressKey(pause, "Escape", 2000);
    expect(pause.paused).toBe(false);
  });

  it("do nothing else while the game runs", () => {
    const pause = createPause();

    expect(pressKey(pause, "n", 1000)).toBeNull();
    expect(pressKey(pause, "y", 1000)).toBeNull();
    expect(pause.paused).toBe(false);
    expect(pause.confirming).toBe(false);
  });

  it("ask to confirm New Hero on N, and start one on Y, resuming", () => {
    const pause = createPause();
    pressKey(pause, "Escape", 1000);

    expect(pressKey(pause, "N", 2000)).toBeNull();
    expect(pause.confirming).toBe(true);
    expect(pressKey(pause, "y", 3000)).toBe("newHero");
    expect(pause.confirming).toBe(false);
    expect(pause.paused).toBe(false);
  });

  it("take no Y for New Hero without the question first", () => {
    const pause = createPause();
    pressKey(pause, "Escape", 1000);

    expect(pressKey(pause, "y", 2000)).toBeNull();
    expect(pause.paused).toBe(true);
  });

  it.each([
    "n",
    "Escape",
  ])("go back from the question to the menu on %s", (key) => {
    const pause = createPause();
    pressKey(pause, "Escape", 1000);
    pressKey(pause, "n", 2000);

    expect(pressKey(pause, key, 3000)).toBeNull();
    expect(pause.confirming).toBe(false);
    expect(pause.paused).toBe(true);
    expect(pressKey(pause, "y", 4000)).toBeNull();
  });

  it("forget the question when the menu is closed", () => {
    const pause = createPause();
    pressKey(pause, "Escape", 1000);
    pressKey(pause, "n", 2000);

    togglePause(pause, 3000);
    togglePause(pause, 4000);

    expect(pause.confirming).toBe(false);
    expect(pressKey(pause, "y", 5000)).toBeNull();
  });
});
