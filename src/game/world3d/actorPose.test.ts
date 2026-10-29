import { describe, expect, it } from "vitest";
import { scrubTime, turnTowards } from "./actorPose";

describe("turnTowards", () => {
  it("snaps on the first pose", () => {
    expect(turnTowards(null, 0, 0.016, 18)).toBeCloseTo(Math.PI / 2);
  });

  it("eases the short way round the wrap", () => {
    // Model turn 3.0 rad; facing -3.0 gives a target of PI/2 + 3 = 4.57,
    // 1.57 away directly, but the target is equivalent to -1.71.
    const turned = turnTowards(3, -3, 0.01, 18);
    expect(turned).toBeGreaterThan(3);
  });
});

describe("scrubTime", () => {
  it("holds a one-shot short of the end", () => {
    expect(scrubTime({ progress: 1 }, 2)).toBeCloseTo(2 - 1e-3);
  });

  it("wraps a loop, offset by its phase", () => {
    expect(scrubTime({ seconds: 1.5 }, 2, 1)).toBeCloseTo(0.5);
  });
});
