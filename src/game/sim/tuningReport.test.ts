import { describe, expect, it } from "vitest";
import { tuningReport } from "./tuningReport";

describe("tuningReport", () => {
  it("gives each Hero Level's Experience to the next and the kills of own-Level Skeletons it takes", () => {
    const { levels } = tuningReport("skeleton", []);

    expect(levels[0]).toEqual({
      level: 1,
      toNext: 500,
      killExperience: 100,
      kills: 5,
    });
    // 1,000 to go at 400 a kill: the third kill gets there.
    expect(levels[1]).toEqual({
      level: 2,
      toNext: 1_000,
      killExperience: 400,
      kills: 3,
    });
  });

  it("stops at the Level before the cap, as the cap has no next", () => {
    const { levels } = tuningReport("skeleton", []);

    expect(levels).toHaveLength(98);
    expect(levels.at(-1)?.level).toBe(98);
  });

  it("gives the Monster's numbers in each Combat Area, by Area Level", () => {
    const { areas } = tuningReport("skeleton", [
      { name: "town", areaLevel: null },
      { name: "crypt", areaLevel: 4 },
      { name: "catacombs", areaLevel: 1 },
    ]);

    expect(areas).toEqual([
      {
        area: "catacombs",
        areaLevel: 1,
        maxLife: 60,
        damage: [4, 8],
        attackRating: 20,
        defense: 135,
        experience: 100,
      },
      {
        area: "crypt",
        areaLevel: 4,
        maxLife: 105,
        damage: [6, 13],
        attackRating: 26,
        defense: 196,
        experience: 1_000,
      },
    ]);
  });
});
