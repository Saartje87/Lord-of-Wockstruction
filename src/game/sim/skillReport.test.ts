import { describe, expect, it } from "vitest";
import type { MonsterType } from "../tuning/monsters";
import { castTuning, PASSIVE_SKILLS, skillTuning } from "../tuning/skills";
import { skillReport } from "./skillReport";
import { skillManaCost } from "./world";

/** A Combat Area's name, Area Level and a Spawn of each of `monsters`. */
function area(name: string, areaLevel: number | null, monsters: MonsterType[]) {
  const pos = { x: 1, y: 1 };
  return {
    name,
    areaLevel,
    spawns: monsters.map((monster) => ({ monster, count: 1, pos })),
  };
}

describe("skillReport", () => {
  const areas = [
    area("town", null, []),
    area("crypt", 9, ["skeleton", "zombie", "skeleton"]),
    area("catacombs", 7, ["zombie"]),
    area("cozy-plains", 1, ["skeleton"]),
  ];

  it("has a row per Skill Level for each cast Skill and none for a Passive Skill", () => {
    const rows = skillReport(areas, [1, 5]);

    for (const passive of PASSIVE_SKILLS) {
      expect(rows.some((row) => (row.skill as string) === passive)).toBe(false);
    }
    const spear = rows.filter((row) => row.skill === "boneSpear");
    expect(spear.map((row) => row.skillLevel)).toEqual([1, 5]);
    expect(spear[0].mana).toBe(skillManaCost("boneSpear", 1));
    expect(spear[1].mana).toBe(skillManaCost("boneSpear", 5));
  });

  it("shows Synergies and Passive Skills raising a Skill's main number", () => {
    const [row] = skillReport(areas, [5]).filter(
      (one) => one.skill === "boneSpear",
    );
    const damage = row.numbers.find((number) => number.label === "Damage");

    expect(damage).toBeDefined();
    expect(damage?.withSynergies).toBeGreaterThan(damage?.base ?? Infinity);
    expect(damage?.withPassive).toBeGreaterThan(damage?.withSynergies ?? 0);
  });

  it("leaves a number alone that no Synergy or Passive Skill touches", () => {
    const [row] = skillReport(areas, [5]).filter(
      (one) => one.skill === "amplifyDamage",
    );
    const duration = row.numbers.find((number) => number.label === "Duration");

    expect(skillTuning.amplifyDamage.synergies).toEqual([]);
    expect(duration?.withSynergies).toBe(duration?.base);
    expect(duration?.withPassive).toBeGreaterThan(duration?.base ?? Infinity);
  });

  it("counts the casts a damage Skill takes to kill each kind of Monster each Combat Area places", () => {
    const [row] = skillReport(areas, [10]).filter(
      (one) => one.skill === "boneSpear",
    );

    expect(castTuning("boneSpear").effect.type).toBe("projectile");
    expect(row.kills.map(({ area, monster }) => [area, monster])).toEqual([
      ["cozy-plains", "skeleton"],
      ["catacombs", "zombie"],
      ["crypt", "skeleton"],
      ["crypt", "zombie"],
    ]);
    // A Skeleton of Area Level 1 has 60 Life; a Skill Level 10 Spear hits harder.
    expect(row.kills[0].casts).toBe(1);
    expect(row.kills[3].casts).toBeGreaterThanOrEqual(row.kills[0].casts);
  });

  it("gives no kills for a Skill that deals no damage", () => {
    const [row] = skillReport(areas, [1]).filter(
      (one) => one.skill === "golem",
    );

    expect(row.kills).toEqual([]);
  });
});
