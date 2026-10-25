import { describe, expect, it } from "vitest";
import { createPause, gameTime, togglePause } from "./pause";

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
