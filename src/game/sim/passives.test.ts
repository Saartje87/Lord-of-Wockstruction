import { describe, expect, it } from "vitest";
import {
  isPassive,
  PASSIVE_SKILLS,
  type Skill,
  skillTuning,
} from "../tuning/skills";
import { minionDamageRange } from "./minions";
import { emptySkillBar } from "./skillBar";
import { synergyMultiplier } from "./synergies";
import { combatArea } from "./testAreas";
import type { Vec } from "./vec";
import {
  type Corpse,
  createWorld,
  FRESH_PROGRESS,
  minionLevelOf,
  type Progress,
  progressOf,
  type SimEvent,
  step,
  type World,
} from "./world";

/** A Town of one Entry and Exit, and a field of floor with one Skeleton far off. */
function areas() {
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
  return {
    town: map(3, 1, [entry("start", 0, 0), entry("arrive", 1, 0), exit]),
    field: combatArea(
      map(14, 8, [
        entry("start", 0, 0),
        entry("arrive", 1, 0),
        {
          name: "",
          type: "monsterSpawn",
          point: true,
          x: 12.5 * 32,
          y: 7.5 * 32,
          properties: [{ name: "monster", type: "string", value: "skeleton" }],
        },
      ]),
      3,
    ),
  };
}

const AREAS = areas();

/** A World in the field, `skillLevels` over none, `right` on the bar. */
function inField(
  skillLevels: Partial<Progress["skillLevels"]>,
  right: Progress["skillBar"]["right"],
): World {
  const progress: Progress = {
    ...FRESH_PROGRESS,
    level: 20,
    energy: 400,
    skillLevels: { ...FRESH_PROGRESS.skillLevels, ...skillLevels },
    skillBar: { ...emptySkillBar(), right },
  };
  const w = createWorld({ areas: AREAS, seed: 1, progress });
  step(w, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
  for (let i = 0; (w.areaName !== "field" || w.areaChange) && i < 600; i++) {
    step(w, []);
  }
  return w;
}

/** Casts at `target` and waits out the cast, collecting the events. */
function castAt(w: World, target: Vec): SimEvent[] {
  const events = step(w, [{ type: "Cast", slot: "right", target }]);
  for (let i = 0; w.hero.cast && i < 600; i++) events.push(...step(w, []));
  return events;
}

/** Lays a Skeleton Corpse at `pos`. */
function corpseAt(w: World, pos: Vec): Corpse {
  const corpse: Corpse = {
    id: w.nextMonsterId++,
    type: "skeleton",
    monsterLevel: 3,
    pos,
  };
  w.corpses.push(corpse);
  return corpse;
}

/** Puts the field's Skeleton at `pos`. */
function monsterAt(w: World, pos: Vec) {
  const [monster] = w.monsters;
  if (!monster) throw new Error("No Monster");
  monster.pos = { ...pos };
  monster.prevPos = { ...pos };
  monster.home = { ...pos };
  return monster;
}

/** What a Passive Skill gives per Skill Level, as a fraction. */
function share(skill: Skill): number {
  const { passive } = skillTuning[skill];
  if (!passive) throw new Error(`${skill} is not Passive`);
  return passive.percentPerSkillLevel / 100;
}

describe("Passive Skills in the Skill Tree's Branches", () => {
  it.each([
    ["ossifiedWill", "bone", "splinterVolley"],
    ["graveCommand", "summoning", "raiseMage"],
    ["lingeringMalice", "curses", "dread"],
  ] as const)("%s ends the %s Branch after %s", (skill, branch, before) => {
    expect(skillTuning[skill].branch).toBe(branch);
    expect(skillTuning[skill].prerequisites).toContain(before);
    expect(isPassive(skill)).toBe(true);
  });

  it("has Bonebinding start the Summoning Branch beside Raise Skeleton, from Level 1", () => {
    const { branch, grid, prerequisites, requiredLevel } =
      skillTuning.bonebinding;
    expect(isPassive("bonebinding")).toBe(true);
    expect(branch).toBe("summoning");
    expect(prerequisites).toEqual(["raiseSkeleton"]);
    expect(requiredLevel).toBe(1);
    expect(grid.row).toBe(0);
    expect(grid.row).toBe(skillTuning.raiseSkeleton.grid.row);
    expect(Math.abs(grid.column - skillTuning.raiseSkeleton.grid.column)).toBe(
      1,
    );
  });

  it("gives Bonebinding +10% Attack Rating and +80% damage a Skill Level to every Minion kind", () => {
    const { passive } = skillTuning.bonebinding;
    expect(passive.boosts).toEqual([
      "golem",
      "raiseSkeleton",
      "raiseArcher",
      "raiseMage",
    ]);
    expect(passive.attackRatingPercentPerSkillLevel).toBe(10);
    expect(passive.damagePercentPerSkillLevel).toBe(80);
  });

  it("neither give nor get Synergies, and cost no Mana", () => {
    for (const passive of PASSIVE_SKILLS) {
      expect(skillTuning[passive].synergies).toEqual([]);
      expect(skillTuning[passive].manaCost).toBeUndefined();
    }
    for (const skill of Object.keys(skillTuning) as Skill[]) {
      for (const { skill: giver } of skillTuning[skill].synergies) {
        expect(isPassive(giver)).toBe(false);
      }
    }
  });
});

describe("learning a Passive Skill", () => {
  /** A Level 20 Hero with Skill Points, Dread learned and Raise Skeleton on the bar. */
  function learner(): World {
    const w = inField(
      { weaken: 1, dread: 1, raiseSkeleton: 1 },
      "raiseSkeleton",
    );
    w.hero.progress.skillPoints = 3;
    return w;
  }

  it("leaves the Skill Bar alone", () => {
    const w = learner();
    const bar = { ...progressOf(w).skillBar };

    const events = step(w, [
      { type: "SpendSkillPoint", skill: "lingeringMalice" },
    ]);

    expect(progressOf(w).skillLevels.lingeringMalice).toBe(1);
    expect(events.some((event) => event.type === "SkillLevelRaised")).toBe(
      true,
    );
    expect(progressOf(w).skillBar).toEqual(bar);
  });

  it("needs its Prerequisite learned, like any Skill", () => {
    const w = inField({}, "raiseSkeleton");
    w.hero.progress.skillPoints = 3;

    step(w, [{ type: "SpendSkillPoint", skill: "lingeringMalice" }]);

    expect(progressOf(w).skillLevels.lingeringMalice).toBe(0);
  });

  it("can't be put on the Skill Bar", () => {
    const w = inField({ graveCommand: 2 }, "raiseSkeleton");

    const events = step(w, [
      { type: "PutSkillOnBar", skill: "graveCommand", slot: "key1" },
    ]);

    expect(events).toEqual([]);
    expect(progressOf(w).skillBar.key1).toBeNull();
  });
});

describe("Ossified Will", () => {
  /** The Corpse Explosion burst, one fixed roll, with the Passive and a Synergy giver. */
  function burst(will: number, amplify = 0): number {
    const w = inField(
      { corpseExplosion: 1, ossifiedWill: will, amplifyDamage: amplify },
      "corpseExplosion",
    );
    const { effect } = skillTuning.corpseExplosion;
    if (effect.type !== "explode") throw new Error("Not a burst");
    skillTuning.corpseExplosion.effect = { ...effect, share: [0.5, 0.5] };
    monsterAt(w, { x: 6, y: 4 });
    corpseAt(w, { x: 6, y: 4 });
    const hit = castAt(w, { x: 6, y: 4 }).find(
      (event) => event.type === "HitLanded",
    );
    if (hit?.type !== "HitLanded") throw new Error("No hit");
    return hit.damage;
  }

  it("raises Bone Skill damage by the tuned share per Skill Level", () => {
    const plain = burst(0);
    const grown = burst(5);
    expect(
      Math.abs(grown - plain * (1 + share("ossifiedWill") * 5)),
    ).toBeLessThan(1.5);
  });

  it("stacks apart from Synergies, the two factors multiplying", () => {
    const levels = { ...FRESH_PROGRESS.skillLevels, amplifyDamage: 5 };
    const synergy = synergyMultiplier(levels, "corpseExplosion");
    const plain = burst(0);
    const stacked = burst(5, 5);
    const product = plain * synergy * (1 + share("ossifiedWill") * 5);
    const sum = plain * (synergy + share("ossifiedWill") * 5);
    expect(Math.abs(stacked - product)).toBeLessThan(1.5);
    expect(Math.abs(stacked - sum)).toBeGreaterThan(1.5);
  });

  it("makes Bone Ward soak more", () => {
    const ward = (will: number) => {
      const w = inField({ boneWard: 1, ossifiedWill: will }, "boneWard");
      castAt(w, { x: 3, y: 3 });
      return w.hero.boneWard?.full ?? 0;
    };
    const base = ward(0);
    expect(ward(4)).toBe(Math.round(base * (1 + share("ossifiedWill") * 4)));
  });
});

describe("Grave Command", () => {
  /** The Raised Skeleton brought with Grave Command at `command`. */
  function skeletonWith(command: number) {
    const w = inField(
      { raiseSkeleton: 1, graveCommand: command },
      "raiseSkeleton",
    );
    corpseAt(w, { x: 5, y: 4 });
    castAt(w, { x: 5, y: 4 });
    const [minion] = w.minions;
    if (!minion) throw new Error("No Minion");
    return { minion, now: minionLevelOf(w, minion) };
  }

  it("gives Minions more Life and damage by the tuned share per Skill Level", () => {
    const factor = 1 + share("graveCommand") * 4;
    const plain = skeletonWith(0);
    const boosted = skeletonWith(4);

    expect(boosted.minion.life).toBe(Math.round(plain.minion.maxLife * factor));
    const [least, most] = minionDamageRange(plain.now);
    expect(minionDamageRange(boosted.now)).toEqual([
      Math.round(least * factor),
      Math.round(most * factor),
    ]);
  });
});

describe("Lingering Malice", () => {
  /** What Amplify Damage cast at the Skeleton does with the Passive at `malice`. */
  function curse(malice: number) {
    const w = inField(
      { amplifyDamage: 1, lingeringMalice: malice },
      "amplifyDamage",
    );
    const monster = monsterAt(w, { x: 6, y: 4 });
    const events = castAt(w, { x: 6, y: 4 });
    const cast = events.find((event) => event.type === "CurseCast");
    if (cast?.type !== "CurseCast") throw new Error("No Curse");
    return { radius: cast.radius, left: monster.curse?.left ?? 0 };
  }

  it("makes Curses last longer and reach further by the tuned share per Skill Level", () => {
    const factor = 1 + share("lingeringMalice") * 3;
    const plain = curse(0);
    const long = curse(3);

    expect(long.radius).toBeCloseTo(plain.radius * factor);
    expect(Math.abs(long.left - plain.left * factor)).toBeLessThan(
      plain.left * 0.05,
    );
  });
});
