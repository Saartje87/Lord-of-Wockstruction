import { describe, expect, it } from "vitest";
import { type CastSkill, type Skill, skillTuning } from "../tuning/skills";
import { skillNumbers } from "./skillNumbers";
import { SKILLS, skillManaCost } from "./world";

/** Skill Levels of 0 everywhere but where `given` says otherwise. */
function levels(given: Partial<Record<Skill, number>> = {}) {
  const all = Object.fromEntries(SKILLS.map((skill) => [skill, 0]));
  return { ...all, ...given } as Record<Skill, number>;
}

const CASTS = SKILLS.filter(
  (skill): skill is CastSkill => skillTuning[skill].effect !== undefined,
);

function line(
  skill: CastSkill,
  skillLevel: number,
  label: string,
  given: Partial<Record<Skill, number>> = {},
) {
  return skillNumbers(skill, skillLevel, levels(given)).find(
    (one) => one.label === label,
  );
}

describe("skillNumbers", () => {
  it("gives every cast Skill its Mana cost at that Skill Level", () => {
    for (const skill of CASTS) {
      expect(line(skill, 3, "Mana")?.text).toBe(
        String(skillManaCost(skill, 3)),
      );
    }
  });

  it("gives a Projectile Skill's damage range with its Damage Type", () => {
    expect(line("boneSpear", 1, "Damage")?.text).toMatch(/^\d+-\d+ Physical$/);
  });

  it("raises a Skill's damage with a Synergy giver and a Passive Skill", () => {
    const damage = (given: Partial<Record<Skill, number>>) =>
      line("boneSpear", 5, "Damage", given)?.value ?? 0;
    const alone = damage({ boneSpear: 5 });
    const [giver] = skillTuning.boneSpear.synergies;
    const withSynergy = damage({ boneSpear: 5, [giver.skill]: 10 });
    expect(withSynergy).toBeGreaterThan(alone);
    const booster = (Object.keys(skillTuning) as Skill[]).find((skill) => {
      const tuning = skillTuning[skill];
      return tuning.passive?.boosts.includes("boneSpear");
    });
    expect(booster).toBeDefined();
    const withPassive = damage({
      boneSpear: 5,
      [giver.skill]: 10,
      [booster as Skill]: 10,
    });
    expect(withPassive).toBeGreaterThan(withSynergy);
  });

  it("adds the shard count to Splinter Volley", () => {
    expect(line("splinterVolley", 1, "Shards")?.value).toBe(
      (skillTuning.splinterVolley.effect as { shards: number }).shards,
    );
    expect(line("splinterVolley", 1, "Damage")?.text).toMatch(/ Physical$/);
  });

  it("gives Corpse Explosion as a share of Corpse Life with Damage Types and Radius", () => {
    expect(line("corpseExplosion", 1, "Damage")?.text).toMatch(
      /^[\d.]+%-[\d.]+% of Corpse Life \(50% Physical, 50% Fire\)$/,
    );
    expect(line("corpseExplosion", 1, "Radius")?.text).toMatch(/ tiles$/);
  });

  it("says what a Curse does, with its Radius and Duration", () => {
    expect(line("amplifyDamage", 1, "Effect")?.text).toBe("Takes +50% damage");
    expect(line("weaken", 1, "Effect")?.text).toBe("Deals -40% damage");
    expect(line("amplifyDamage", 1, "Duration")?.text).toMatch(/ seconds$/);
    expect(line("amplifyDamage", 1, "Radius")?.text).toMatch(/ tiles$/);
  });

  it("gives Bone Ward's soak and Bone Wall's length, piece Life and Duration", () => {
    expect(line("boneWard", 1, "Soak")?.text).toBe("45");
    expect(line("boneWall", 1, "Length")?.text).toBe("3 tiles");
    expect(line("boneWall", 1, "Piece Life")?.text).toBe("60");
    expect(line("boneWall", 1, "Duration")?.text).toBe("10 seconds");
  });

  it("gives a Minion's Life and damage, and the count for raises", () => {
    expect(line("golem", 1, "Life")).toBeDefined();
    expect(line("golem", 1, "Count")).toBeUndefined();
    expect(line("raiseSkeleton", 1, "Count")?.text).toBe("2");
    expect(line("raiseArcher", 1, "Damage")?.text).toMatch(/^\d+-\d+$/);
  });

  it("shows a Raised Mage's Count, Life and damage", () => {
    expect(line("raiseMage", 1, "Count")?.text).toBe("1");
    expect(line("raiseMage", 5, "Count")?.text).toBe("2");
    expect(line("raiseMage", 1, "Life")).toBeDefined();
    expect(line("raiseMage", 1, "Damage")?.text).toMatch(/^\d+-\d+$/);
  });

  it("counts Bonebinding in a Minion Skill's damage and Attack Rating, not its Life", () => {
    for (const skill of [
      "golem",
      "raiseSkeleton",
      "raiseArcher",
      "raiseMage",
    ] as const) {
      const plain = (label: string) => line(skill, 3, label)?.value ?? 0;
      const bound = (label: string) =>
        line(skill, 3, label, { bonebinding: 4 })?.value ?? 0;
      expect(bound("Attack Rating"), skill).toBeGreaterThan(
        plain("Attack Rating"),
      );
      expect(bound("Damage"), skill).toBeGreaterThan(plain("Damage"));
      expect(bound("Life"), skill).toBe(plain("Life"));
    }
  });

  it("shows no cast time, Projectile speed or range", () => {
    for (const skill of CASTS) {
      for (const one of skillNumbers(skill, 1, levels())) {
        expect(one.label.toLowerCase()).not.toMatch(/cast|speed|range/);
      }
    }
  });
});
