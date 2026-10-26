import { describe, expect, it } from "vitest";
import { castKeyOrder } from "./keys";

describe("the Skill keys", () => {
  it.each([
    ["1", "key1"],
    ["2", "key2"],
    ["3", "key3"],
    ["4", "key4"],
  ] as const)("cast with %s the Skill in slot %s at the cursor", (key, slot) => {
    expect(castKeyOrder(key, { x: 3.2, y: 4.7 })).toEqual({
      type: "Cast",
      slot,
      target: { x: 3.2, y: 4.7 },
    });
  });

  it("cast nothing with the cursor off the canvas", () => {
    expect(castKeyOrder("1", null)).toBeNull();
  });

  it.each(["5", "0", "a", "Enter"])("leave %s alone", (key) => {
    expect(castKeyOrder(key, { x: 1, y: 1 })).toBeNull();
  });
});
