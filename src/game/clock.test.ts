import { describe, expect, it } from "vitest";
import { advance, createClock } from "./clock";
import { STEP_MS } from "./sim/units";

describe("fixed-step clock", () => {
  it("steps at 60 Hz", () => {
    expect(STEP_MS).toBeCloseTo(16.667, 3);
  });

  it("takes no step on a frame shorter than one step", () => {
    const clock = createClock();

    const { steps, alpha } = advance(clock, STEP_MS / 4);

    expect(steps).toBe(0);
    expect(alpha).toBeCloseTo(0.25);
  });

  it("carries leftover time into the next frame", () => {
    const clock = createClock();
    advance(clock, STEP_MS * 0.75);

    const { steps, alpha } = advance(clock, STEP_MS * 0.5);

    expect(steps).toBe(1);
    expect(alpha).toBeCloseTo(0.25);
  });

  it("takes several steps on a long frame", () => {
    const clock = createClock();

    const { steps, alpha } = advance(clock, STEP_MS * 3.5);

    expect(steps).toBe(3);
    expect(alpha).toBeCloseTo(0.5);
  });

  it("treats a negative frame time as no time", () => {
    const clock = createClock();

    const { steps, alpha } = advance(clock, -2);

    expect(steps).toBe(0);
    expect(alpha).toBe(0);
  });

  it("caps a hitch at 250 ms of steps instead of spiralling", () => {
    const clock = createClock();

    expect(advance(clock, 5000).steps).toBe(15);
    expect(advance(clock, STEP_MS / 2).steps).toBe(0);
  });
});
