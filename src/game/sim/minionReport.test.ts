import { describe, expect, it } from "vitest";
import { minionTuning } from "../tuning/minions";
import { minionReport, summoningBudget } from "./minionReport";
import { monsterDefense } from "./monsters";
import { chanceToHit } from "./world";

describe("minionReport", () => {
  it("puts about half the Skill Points into Summoning, the same in both cases", () => {
    const [row] = minionReport([21]);
    const spent = (levels: Partial<Record<string, number>>) =>
      Object.values(levels).reduce<number>((sum, n) => sum + (n ?? 0), 0);

    expect(row.skillPoints).toBe(20);
    expect(row.budget).toBe(summoningBudget(21));
    expect(row.budget).toBe(10);
    expect(spent(row.base.skillLevels)).toBe(10);
    expect(spent(row.withPassive.skillLevels)).toBe(10);
    expect(row.base.skillLevels.graveCommand).toBeUndefined();
    expect(row.withPassive.skillLevels.graveCommand).toBe(2);
  });

  it("leaves out Skills the Level hasn't opened, and the Passive Skill below its Level", () => {
    const [row] = minionReport([4]);

    expect(row.base.minions.map((one) => one.skill)).toEqual(["raiseSkeleton"]);
    expect(row.withPassive).toEqual(row.base);
  });

  it("works a Minion's chance to hit and time to kill from the live tuning", () => {
    const [row] = minionReport([8]);
    const golem = row.base.minions.find((one) => one.skill === "golem");
    const { windUpMs, rootMs, recoveryMs } = minionTuning.golem;
    if (!golem) throw new Error("no Golem");

    const defense = monsterDefense({ type: "skeleton", monsterLevel: 8 });
    expect(golem.chanceToHit).toBe(chanceToHit(golem.attackRating, defense));
    expect(golem.damagePerSecond).toBeCloseTo(
      (golem.chanceToHit * golem.meanHit) /
        ((windUpMs + rootMs + recoveryMs) / 1000),
    );
    expect(golem.secondsToKill).toBeCloseTo(
      row.targetLife / (golem.damagePerSecond * golem.count),
    );
    expect(row.base.allSecondsToKill).toBeGreaterThan(0);
  });
});
