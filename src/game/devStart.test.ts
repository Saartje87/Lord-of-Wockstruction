import { describe, expect, it } from "vitest";
import { devStartOf } from "./devStart";

describe("devStartOf", () => {
  it("reads the Area and Entry from the query", () => {
    expect(devStartOf("?area=catacombs&entry=from-town")).toEqual({
      area: "catacombs",
      entry: "from-town",
    });
  });

  it("is null without both an Area and an Entry", () => {
    expect(devStartOf("")).toBeNull();
    expect(devStartOf("?area=catacombs")).toBeNull();
    expect(devStartOf("?entry=from-town")).toBeNull();
  });
});
