import { describe, expect, it } from "vitest";
import { devStartOf, skipsStartScreen } from "./devStart";

describe("skipsStartScreen", () => {
  it("skips the Start Screen in development with a dev start", () => {
    expect(skipsStartScreen("?area=catacombs&entry=from-town", true)).toBe(
      true,
    );
  });

  it("shows it in development without a dev start", () => {
    expect(skipsStartScreen("", true)).toBe(false);
    expect(skipsStartScreen("?stats", true)).toBe(false);
  });

  it("shows it in production, which ignores a dev start", () => {
    expect(skipsStartScreen("?area=catacombs&entry=from-town", false)).toBe(
      false,
    );
  });
});

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
