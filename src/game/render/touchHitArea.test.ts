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
});
