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

    expect(levels[0]).toMatchObject({
      level: 1,
      toNext: 500,
      killExperience: 100,
      kills: 5,
    });
    // 1,000 to go at 400 a kill: the third kill gets there.
    expect(levels[1]).toMatchObject({
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
      area("crypt", 4, ["skeleton", "skeleton_archer"]),
      area("ossuary", 8, ["skeleton", "zombie", "skeleton_archer"]),
    ]);

    expect(areas).toEqual([
      {
        area: "catacombs",
        areaLevel: 1,
        maxLife: 150,
        damage: [7, 14],
        attackRating: 25,
        defense: 120,
        experience: 200,
      },
      {
        area: "ossuary",
        areaLevel: 8,
        maxLife: 360,
        damage: [14, 29],
        attackRating: 43,
        defense: 246,
        experience: 4_400,
      },
    ]);
  });

  it("gives the Skeleton Archer's numbers in the Combat Areas that place it", () => {
    const { levels, areas } = tuningReport("skeleton_archer", [
      area("catacombs", 1, ["skeleton", "zombie"]),
      area("crypt", 4, ["skeleton", "skeleton_archer"]),
      area("ossuary", 8, ["skeleton", "zombie", "skeleton_archer"]),
    ]);

    // 500 to go at 110 a kill: the fifth kill gets there.
    expect(levels[0]).toMatchObject({
      level: 1,
      toNext: 500,
      killExperience: 110,
      kills: 5,
    });
    expect(areas).toEqual([
      {
        area: "crypt",
        areaLevel: 4,
        maxLife: 63,
        damage: [5, 10],
        attackRating: 26,
        defense: 196,
        experience: 1_100,
      },
      {
        area: "ossuary",
        areaLevel: 8,
        maxLife: 99,
        damage: [7, 14],
        attackRating: 34,
        defense: 277,
        experience: 2_420,
      },
    ]);
  });

  describe("Gold earned per Hero Level", () => {
    const places = [
      area("town", null, []),
      area("catacombs", 1, ["skeleton"]),
      area("crypt", 4, ["skeleton"]),
      area("ossuary", 8, ["skeleton"]),
      area("bog", 6, ["zombie"]),
    ];

    it("is the Gold Pile chance times the mean amount at the Area Level, times the kills the Level takes", () => {
      const { levels } = tuningReport("skeleton", places);

      // Chance 0.5 and 2 to 5 a Monster Level: 1.75 Gold a kill per Level.
      // Level 1 plays Area Level 1, and 5 kills reach Level 2.
      expect(levels[0].gold).toEqual({
        areaLevel: 1,
        perKill: 1.75,
        total: 8.75,
      });
    });

    it("plays in the deepest Area that places the Monster at or below the Hero Level", () => {
      const { levels } = tuningReport("skeleton", places);

      expect(levels[2].gold?.areaLevel).toBe(1);
      expect(levels[3].gold?.areaLevel).toBe(4);
      expect(levels[6].gold?.areaLevel).toBe(4);
      expect(levels[7].gold?.areaLevel).toBe(8);
      // Past the deepest Area, a Hero keeps to it.
      expect(levels[50].gold?.areaLevel).toBe(8);
    });

    it("grows with the Area Levels a Level plays in", () => {
      const { levels } = tuningReport("skeleton", places);

      expect(levels[3].gold?.perKill).toBe(7);
      expect(levels[7].gold?.perKill).toBe(14);
    });

    it("starts a Hero below the shallowest Area there", () => {
      const { levels } = tuningReport("skeleton", [
        area("crypt", 4, ["skeleton"]),
      ]);

      expect(levels[0].gold?.areaLevel).toBe(4);
    });

    it("is none where no Area places the Monster", () => {
      const { levels } = tuningReport("skeleton", []);

      expect(levels[0].gold).toBeNull();
    });
  });
});
