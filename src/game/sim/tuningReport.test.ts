import { describe, expect, it } from "vitest";
import type { MonsterType } from "../tuning/monsters";
import { tuningReport } from "./tuningReport";

/** A Combat Area's name, Area Level and a Spawn of each of `monsters`. */
function area(name: string, areaLevel: number | null, monsters: MonsterType[]) {
  const pos = { x: 1, y: 1 };
  return {
    name,
    areaLevel,
    spawns: monsters.map((monster) => ({ monster, count: 1, pos })),
  };
}

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
      area("town", null, []),
      area("crypt", 4, ["skeleton"]),
      area("catacombs", 1, ["skeleton", "zombie"]),
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

  it("leaves out the Combat Areas that don't place the Monster", () => {
    const { areas } = tuningReport("zombie", [
      area("catacombs", 1, ["skeleton", "zombie"]),
      area("crypt", 4, ["skeleton"]),
    ]);

    expect(areas).toEqual([
      {
        area: "catacombs",
        areaLevel: 1,
        maxLife: 150,
        damage: [7, 14],
        attackRating: 25,
        defense: 120,
        experience: 175,
      },
    ]);
  });
});
