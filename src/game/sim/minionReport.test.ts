import { describe, expect, it } from "vitest";
import { minionTuning } from "../tuning/minions";
import { monsterTuning } from "../tuning/monsters";
import { minionReport, summoningBudget } from "./minionReport";
import { minionDefense } from "./minions";
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

  it("leaves out Skills the Level hasn't opened, and Grave Command below its Level", () => {
    const [row] = minionReport([4]);

    expect(row.base.minions.map((one) => one.skill)).toEqual(["raiseSkeleton"]);
    expect(row.withPassive.skillLevels.graveCommand).toBeUndefined();
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

  it("has a full group of Raised Skeletons kill an own-Level trash Skeleton in about 5 s with the base Skills alone, at every Level", () => {
    for (const row of minionReport()) {
      const skeletons = row.base.minions.find(
        (one) => one.skill === "raiseSkeleton",
      );
      if (!skeletons)
        throw new Error(`No Raised Skeletons at ${row.heroLevel}`);

      expect(skeletons.secondsToKill).toBeGreaterThan(3);
      expect(skeletons.secondsToKill).toBeLessThan(8);
      expect(skeletons.chanceToHit).toBeGreaterThanOrEqual(0.65);
      expect(skeletons.chanceToHit).toBeLessThanOrEqual(0.9);
    }
  });

  it("has the Raised Archers hit most of the time too, and Monsters hit the Golem much less than 80% of the time", () => {
    for (const { heroLevel, base } of minionReport()) {
      for (const one of base.minions) {
        if (one.skill === "raiseArcher") {
          expect(one.chanceToHit).toBeGreaterThanOrEqual(0.65);
          expect(one.chanceToHit).toBeLessThanOrEqual(0.9);
        }
        if (one.skill === "golem") {
          const defense = minionDefense({
            type: "golem",
            skillLevel: one.skillLevel,
          });
          const { attackRating, growth } = monsterTuning.skeleton;
          const monster = Math.round(
            attackRating * (1 + growth.attackRating * (heroLevel - 1)),
          );
          expect(chanceToHit(monster, defense)).toBeLessThan(0.65);
        }
      }
    }
  });

  it("has a full group of Raised Skeletons kill an own-Level trash Skeleton in about 2-3 s with the Passive Skills taken, from Level 16", () => {
    for (const row of minionReport([16, 20])) {
      const skeletons = row.withPassive.minions.find(
        (one) => one.skill === "raiseSkeleton",
      );
      if (!skeletons)
        throw new Error(`No Raised Skeletons at ${row.heroLevel}`);

      expect(row.withPassive.skillLevels.bonebinding).toBeGreaterThan(0);
      expect(row.withPassive.skillLevels.graveCommand).toBeGreaterThan(0);
      expect(skeletons.secondsToKill).toBeGreaterThan(1.5);
      expect(skeletons.secondsToKill).toBeLessThan(3.5);
    }
  });

  it("has the Passive Skills help at every Level they are open, never leaving the Raised Skeletons slower than with the base Skills alone", () => {
    for (const row of minionReport([8, 12, 16, 20])) {
      const kill = (minions: typeof row.base.minions) =>
        minions.find((one) => one.skill === "raiseSkeleton")?.secondsToKill ??
        Infinity;

      expect(row.withPassive.skillLevels.bonebinding).toBeGreaterThan(0);
      expect(kill(row.withPassive.minions)).toBeLessThan(
        kill(row.base.minions),
      );
    }
  });

  it("keeps Bonebinding out of the with-Passives case until Raise Skeleton has a point", () => {
    const [row] = minionReport([4]);

    expect(row.withPassive).toEqual(row.base);
    expect(row.withPassive.skillLevels.bonebinding).toBeUndefined();
  });

  it("grows Raised minions' Attack Rating per Skill Level at least as fast as Monster Defense per Monster Level", () => {
    const { defense } = monsterTuning.skeleton.growth;
    for (const type of ["raisedSkeleton", "raisedArcher"] as const) {
      expect(minionTuning[type].growth.attackRating).toBeGreaterThanOrEqual(
        defense,
      );
    }
  });
});
