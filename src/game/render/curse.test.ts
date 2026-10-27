import { describe, expect, it } from "vitest";
import { CURSE_CIRCLE, curseCircle } from "./curse";

describe("curseCircle", () => {
  it("lies flat on the floor over the whole radius at once", () => {
    const circle = curseCircle(0, 2);

    // A 2-tile circle on the floor is about 272 by 136 CSS px across.
    expect(circle?.radiusX).toBeCloseTo(271.5, 0);
    expect(circle?.radiusY).toBeCloseTo(135.8, 0);
    expect(circle?.alpha).toBeCloseTo(1);
  });

  it("fades as it plays", () => {
    const early = curseCircle(CURSE_CIRCLE.ms * 0.25, 2);
    const late = curseCircle(CURSE_CIRCLE.ms * 0.75, 2);

    expect(late?.alpha).toBeLessThan(early?.alpha ?? 0);
  });

  it("is wider for a wider Curse", () => {
    expect(curseCircle(0, 3)?.radiusX).toBeGreaterThan(
      curseCircle(0, 2)?.radiusX ?? Infinity,
    );
  });

  it("is gone once it has played", () => {
    expect(curseCircle(CURSE_CIRCLE.ms, 2)).toBeNull();
  });
});
