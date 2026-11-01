import { describe, expect, it } from "vitest";
import { encodeSave, parseSave, saveOf } from "../save";
import { AFFIX_KINDS, type AffixKind, affixOf } from "../tuning/items";
import { type Skill, skillTuning } from "../tuning/skills";
import { rollItem } from "./affixes";
import { emptyBelt } from "./belt";
import { type Belongings, inventoryOf } from "./inventory";
import { createRng } from "./random";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import {
  canRaiseSkill,
  createWorld,
  FRESH_PROGRESS,
  minionLevelOf,
  type Progress,
  type SimEvent,
  SKILLS,
  skillLevelOf,
  step,
  type World,
} from "./world";

const layer = (
  name: string,
  data: number[],
  width: number,
  height: number,
) => ({ type: "tilelayer", name, width, height, data });
const map = (width: number, height: number, objects: object[]) => ({
  orientation: "orthogonal",
  width,
  height,
  tilewidth: 32,
  tileheight: 32,
  tilesets: [{ firstgid: 1, name: "test", tiles: [] }],
  layers: [
    layer("floor", new Array(width * height).fill(1), width, height),
    layer("walls & props", new Array(width * height).fill(0), width, height),
    { type: "objectgroup", name: "objects", objects },
  ],
});
const entry = (name: string, x: number, y: number) => ({
  name,
  type: "entry",
  x: (x + 0.5) * 32,
  y: (y + 0.5) * 32,
});
const exit = {
  name: "",
  type: "exit",
  x: 2 * 32,
  y: 0,
  width: 32,
  height: 32,
  properties: [
    { name: "area", type: "string", value: "field" },
    { name: "entry", type: "string", value: "arrive" },
  ],
};
const AREAS = {
  town: map(3, 1, [entry("start", 0, 0), entry("arrive", 1, 0), exit]),
  field: combatArea(
    map(8, 8, [entry("start", 0, 0), entry("arrive", 1, 0)]),
    3,
  ),
};

/** The Affix kind raising `skill`. */
const raising = (skill: Skill) =>
  `skill${skill[0].toUpperCase()}${skill.slice(1)}` as AffixKind;

type Worn = Belongings["equipment"];

/** A Magic Bone Wand raising `skill` by `value`. */
const wand = (skill: Skill, value = 1) => ({
  type: "boneWand" as const,
  rarity: "magic" as const,
  affixes: [{ kind: raising(skill), grade: value - 1, value }],
});

function wearing(
  equipment: Worn,
  progress: Partial<Progress> = {},
  inventory: Belongings["inventory"] = [],
): World {
  return createWorld({
    areas: AREAS,
    seed: 1,
    progress: { ...FRESH_PROGRESS, ...progress },
    belongings: { inventory, equipment, belt: emptyBelt() },
  });
}

/** Walks the Hero out of Town into the field. */
function intoField(w: World): World {
  step(w, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
  for (let i = 0; (w.areaName !== "field" || w.areaChange) && i < 600; i++) {
    step(w, []);
  }
  return w;
}

describe("the Skill Level Affix kinds", () => {
  it("are one Wand-only Suffix per Skill, in grades +1, +2 and +3 from Monster Level 1, 5 and 9", () => {
    for (const skill of SKILLS) {
      expect(AFFIX_KINDS).toContain(raising(skill));
      const kind = affixOf(raising(skill));
      expect(kind.side).toBe("suffix");
      expect(kind.rollsOn).toEqual(["wand"]);
      expect(kind.grades.map((g) => g.range)).toEqual([
        [1, 1],
        [2, 2],
        [3, 3],
      ]);
      expect(kind.grades.map((g) => g.fromMonsterLevel)).toEqual([1, 5, 9]);
    }
  });

  it("roll on Wands only, and a Rare Wand can raise two different Skills", () => {
    const rng = createRng(11);
    const skillAffixes = (type: "yewWand" | "shortSword") =>
      rollItem(rng, type, 9).affixes.filter((a) => a.kind.startsWith("skill"));
    let two = false;
    for (let i = 0; i < 2000; i++) {
      const skills = skillAffixes("yewWand");
      if (skills.length === 2) {
        expect(skills[0].kind).not.toBe(skills[1].kind);
        two = true;
      }
      expect(skillAffixes("shortSword")).toEqual([]);
    }
    expect(two).toBe(true);
  });
});

describe("a Skill's Skill Level", () => {
  it("is the learned level plus every Equipped Item's raise, two Wands adding up", () => {
    const w = wearing(
      { weapon: wand("boneSpear", 1), offHand: wand("boneSpear", 2) },
      { skillLevels: { ...FRESH_PROGRESS.skillLevels, boneSpear: 2 } },
    );
    expect(skillLevelOf(w, "boneSpear")).toBe(5);
    expect(skillLevelOf(w, "golem")).toBe(0);
  });

  it("is raised for an unlearned Skill and goes with the Wand, Skill Points unchanged", () => {
    const w = wearing({}, { skillPoints: 3 }, [
      { ...wand("golem", 2), cell: { column: 0, row: 0 } },
    ]);
    const [{ item }] = [...inventoryOf(w)];
    expect(skillLevelOf(w, "golem")).toBe(0);
    step(w, [{ type: "EquipItem", item: item.id }]);
    expect(skillLevelOf(w, "golem")).toBe(2);
    step(w, [{ type: "LiftItem", from: "weapon" }]);
    expect(skillLevelOf(w, "golem")).toBe(0);
    expect(w.hero.progress.skillPoints).toBe(3);
    expect(w.hero.progress.skillLevels.golem).toBe(0);
  });

  it("is not what Prerequisites or spending Skill Points read", () => {
    const after = SKILLS.find(
      (skill) => skillTuning[skill].prerequisites.length === 1,
    );
    if (!after) throw new Error("No Skill has a Prerequisite");
    const before = skillTuning[after].prerequisites[0];
    const w = wearing(
      { weapon: wand(before, 3) },
      { skillPoints: 5, level: 30 },
    );
    expect(skillLevelOf(w, before)).toBe(3);
    expect(canRaiseSkill(w, after)).toBe(false);
    step(w, [{ type: "SpendSkillPoint", skill: before }]);
    expect(w.hero.progress.skillLevels[before]).toBe(1);
    expect(skillLevelOf(w, before)).toBe(4);
    expect(canRaiseSkill(w, after)).toBe(true);
  });
});

describe("casting with a raised Skill", () => {
  const cast = (w: World): SimEvent[] => {
    const events = step(w, [
      { type: "Cast", slot: "right", target: { x: 4.5, y: 4.5 } },
    ]);
    for (let i = 0; w.hero.cast && i < 600; i++) events.push(...step(w, []));
    return events;
  };

  function inField(equipment: Worn, golem = 0): World {
    const w = intoField(
      wearing(equipment, {
        level: 20,
        energy: 400,
        skillLevels: { ...FRESH_PROGRESS.skillLevels, golem },
        skillBar: { ...emptySkillBar(), right: "golem" },
      }),
    );
    w.hero.mana = 500;
    return w;
  }

  it("works for an unlearned Skill on the bar and stops when the Wand comes off", () => {
    const w = inField({ weapon: wand("golem", 1) });
    expect(cast(w).some((e) => e.type === "SkillCast")).toBe(true);
    expect(w.minions.length).toBe(1);
    step(w, [{ type: "LiftItem", from: "weapon" }]);
    const events = cast(w);
    expect(events.some((e) => e.type === "SkillCast")).toBe(false);
    expect(events.some((e) => e.type === "CastFailed")).toBe(true);
  });

  it("casts at the raised Skill Level", () => {
    const w = inField({ weapon: wand("golem", 3) }, 1);
    cast(w);
    expect(minionLevelOf(w, w.minions[0]).skillLevel).toBe(4);
  });

  it("counts a Wand's raise to a giver for Synergies", () => {
    const giver = skillTuning.golem.synergies[0].skill;
    const plain = inField({}, 1);
    cast(plain);
    const boosted = inField({ weapon: wand(giver, 3) }, 1);
    cast(boosted);
    expect(boosted.minions[0].life).toBeGreaterThan(plain.minions[0].life);
  });

  it("keeps a Skill at 0 on the bar through a Save", () => {
    const w = wearing({}, { skillBar: { ...emptySkillBar(), right: "golem" } });
    expect(skillLevelOf(w, "golem")).toBe(0);
    const loaded = parseSave(encodeSave(saveOf(w)));
    expect(loaded?.progress.skillBar.right).toBe("golem");
  });

  it("lets a Skill be put on the bar by a Wand's raise alone", () => {
    const w = wearing(
      { weapon: wand("golem", 1) },
      { skillBar: emptySkillBar() },
    );
    step(w, [{ type: "PutSkillOnBar", skill: "golem", slot: "key1" }]);
    expect(w.hero.progress.skillBar.key1).toBe("golem");
  });
});

describe("the Save", () => {
  it("round-trips a Wand with a Skill Level Affix", () => {
    const w = wearing({ offHand: wand("boneSpear", 2) });
    const loaded = parseSave(encodeSave(saveOf(w)));
    expect(loaded?.belongings.equipment.offHand?.affixes).toEqual([
      { kind: raising("boneSpear"), grade: 1, value: 2 },
    ]);
  });

  it("rejects a Skill Level Affix naming a Skill that doesn't exist, or on a non-Wand", () => {
    const stored = JSON.parse(
      encodeSave(saveOf(wearing({ offHand: wand("boneSpear", 1) }))),
    );
    const bad = structuredClone(stored);
    bad.equipment.offHand.affixes[0].kind = "skillNoSuchThing";
    expect(parseSave(JSON.stringify(bad))).toBeNull();

    const sword = structuredClone(stored);
    sword.equipment = { weapon: { ...stored.equipment.offHand } };
    sword.equipment.weapon.type = "shortSword";
    expect(parseSave(JSON.stringify(sword))).toBeNull();
  });
});
