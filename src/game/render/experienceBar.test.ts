import { describe, expect, it } from "vitest";
import { experienceBar } from "./experienceBar";

describe("experienceBar", () => {
  it("shows a fresh Hero at Level 1 with none of the 500 to Level 2", () => {
    expect(experienceBar(1, 0)).toEqual({
      level: "Lv 1",
      experience: "0 / 500",
      fill: 0,
    });
  });

  it("separates thousands and fills by the progress through the Level", () => {
    // Level 5 needs 7,875 and Level 6 14,175.
    expect(experienceBar(5, 11_025)).toEqual({
      level: "Lv 5",
      experience: "11,025 / 14,175",
      fill: 0.5,
    });
  });

  it("shows full at Level 99", () => {
    expect(experienceBar(99, 3_520_485_254)).toEqual({
      level: "Lv 99",
      experience: "3,520,485,254 / 3,520,485,254",
      fill: 1,
    });
  });
});
