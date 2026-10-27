import { describe, expect, it } from "vitest";
import { CORPSE_BURST, corpseBurst } from "./corpseBurst";

describe("corpseBurst", () => {
  it("starts as a bright flash at the Corpse, its ring not yet spread", () => {
    const burst = corpseBurst(0, 2);

    expect(burst?.flash.alpha).toBeCloseTo(1);
    expect(burst?.ring.radiusX).toBe(0);
  });

  it("spreads its ring flat on the floor out to the burst's radius as it fades", () => {
    const early = corpseBurst(CORPSE_BURST.ms * 0.25, 2);
    const late = corpseBurst(CORPSE_BURST.ms * 0.99, 2);

    // A 2-tile circle on the floor is about 272 by 136 CSS px across.
    expect(late?.ring.radiusX).toBeCloseTo(271.5, 0);
    expect(late?.ring.radiusY).toBeCloseTo(135.8, 0);
    expect(late?.ring.alpha).toBeLessThan(early?.ring.alpha ?? 0);
    expect(late?.flash.alpha).toBeLessThan(early?.flash.alpha ?? 0);
  });

  it("is a wider ring for a wider burst", () => {
    const ms = CORPSE_BURST.ms * 0.5;

    expect(corpseBurst(ms, 3)?.ring.radiusX).toBeGreaterThan(
      corpseBurst(ms, 2)?.ring.radiusX ?? Infinity,
    );
  });

  it("is gone once it has played", () => {
    expect(corpseBurst(CORPSE_BURST.ms, 2)).toBeNull();
  });
});
