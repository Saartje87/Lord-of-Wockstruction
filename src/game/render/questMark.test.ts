import { describe, expect, it } from "vitest";
import { QUEST_MARK, questMarkBob } from "./questMark";

describe("the Quest mark's bob", () => {
  it("stays between resting and its full bob", () => {
    for (let ms = 0; ms < 3000; ms += 50) {
      const lifted = questMarkBob(ms);
      expect(lifted).toBeGreaterThanOrEqual(0);
      expect(lifted).toBeLessThanOrEqual(QUEST_MARK.bob);
    }
  });

  it("comes round after one period", () => {
    expect(questMarkBob(0)).toBeCloseTo(questMarkBob(QUEST_MARK.bobMs));
  });
});
