import { describe, expect, it } from "vitest";
import { touchHitRect } from "./touchHitArea";

describe("a touch hit area", () => {
  it("grows over the rows a Skill's + is drawn on, but stops halfway to the next Skill's rows", () => {
    const plus = { x: 100, y: 100, w: 22, h: 22 };
    const ownRows = { x: 0, y: 95, w: 122, h: 30 };
    // 8 px below the +: the halfway line is 4 px below it, at y 126.
    const nextRows = { x: 0, y: 130, w: 122, h: 120 };

    expect(touchHitRect(plus, [ownRows, nextRows])).toEqual({
      // 44 px wide and up over its own rows...
      x: 89,
      y: 89,
      w: 44,
      // ...but down only to the halfway line.
      h: 37,
    });
  });

  it("stops halfway to a neighbour too big to grow itself", () => {
    // 6 px left of a 36 px button that grows 4 px each way: the halfway
    // line is 3 px left of it, at x 97, though the 44 px neighbour doesn't
    // grow toward it.
    const small = { x: 100, y: 104, w: 36, h: 36 };
    const big = { x: 50, y: 100, w: 44, h: 44 };

    expect(touchHitRect(small, [big]).x).toBe(97);
  });
});
