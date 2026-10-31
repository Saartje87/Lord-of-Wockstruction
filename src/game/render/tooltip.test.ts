import { describe, expect, it } from "vitest";
import { tooltipRect } from "./tooltip";

const screen = { width: 640, height: 320 };

describe("tooltipRect", () => {
  it("goes above what it is about, centred", () => {
    const under = { x: 300, y: 200, w: 40, h: 40 };

    expect(tooltipRect(under, { w: 100, h: 50 }, screen, 6)).toEqual({
      x: 270,
      y: 144,
      w: 100,
      h: 50,
    });
  });

  it("goes under it where there is no room above", () => {
    const under = { x: 300, y: 20, w: 40, h: 40 };

    expect(tooltipRect(under, { w: 100, h: 50 }, screen, 6).y).toBe(66);
  });

  it("stays on the screen when it fits neither above nor below", () => {
    const under = { x: 300, y: 130, w: 40, h: 40 };
    const rect = tooltipRect(under, { w: 100, h: 240 }, screen, 6);

    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.h).toBeLessThanOrEqual(screen.height);
  });
});
