import { describe, expect, it } from "vitest";
import { castKeyOrder } from "./keys";

describe("the Skill keys", () => {
  it.each([
    ["q", "key1"],
    ["w", "key2"],
    ["e", "key3"],
    ["r", "key4"],
    ["Q", "key1"],
    ["R", "key4"],
  ] as const)("cast with %s the Skill in slot %s at the cursor", (key, slot) => {
    expect(castKeyOrder(key, { x: 3.2, y: 4.7 })).toEqual({
      type: "Cast",
      slot,
      target: { x: 3.2, y: 4.7 },
    });
  });

  it("cast nothing with the cursor off the canvas", () => {
    expect(castKeyOrder("q", null)).toBeNull();
  });

  it.each([
    "1",
    "2",
    "3",
    "4",
    "5",
    "0",
    "a",
    "Enter",
  ])("leave %s alone", (key) => {
    expect(castKeyOrder(key, { x: 1, y: 1 })).toBeNull();
  });
});
