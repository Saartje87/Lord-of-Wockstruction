import { describe, expect, it } from "vitest";
import { msToSteps, perStep } from "./units";

describe("unit conversion", () => {
  it("turns a duration in ms into whole 1/60 s steps, rounding to nearest", () => {
    expect(msToSteps(1000)).toBe(60);
    expect(msToSteps(120)).toBe(7); // 7.2
    expect(msToSteps(140)).toBe(8); // 8.4
    expect(msToSteps(125)).toBe(8); // 7.5 rounds up
  });

  it("turns a per-second rate into a per-step rate", () => {
    expect(perStep(6)).toBeCloseTo(0.1);
    expect(perStep(5.5)).toBeCloseTo(0.091667, 6);
  });
});
