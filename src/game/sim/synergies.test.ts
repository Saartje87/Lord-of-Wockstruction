import { afterEach, describe, expect, it } from "vitest";
import { type Skill, skillTuning } from "../tuning/skills";
import { minionDamageRange, minionMaxLife } from "./minions";
import { emptySkillBar } from "./skillBar";
import { synergyMultiplier } from "./synergies";
import { combatArea } from "./testAreas";
import type { Vec } from "./vec";
import {
  type Corpse,
  createWorld,
  FRESH_PROGRESS,
  type Progress,
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

/** A World with the Hero in the field, `skillLevels` over none, `right` on the bar. */
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

const originals = structuredClone(skillTuning);
afterEach(() => {
  for (const skill of Object.keys(skillTuning) as Skill[]) {
    skillTuning[skill].synergies = originals[skill].synergies;
    skillTuning[skill].effect = originals[skill].effect;
  }
});

/** The first Synergy a Skill has in tuning. */
function firstSynergy(skill: Skill) {
  const synergy = skillTuning[skill].synergies[0];
  if (!synergy) throw new Error(`${skill} has no Synergy`);
  return synergy;
}

describe("the Synergy multiplier", () => {
  it("is 1 for a Skill with none, and 1 + % x Skill Level for a giver", () => {
    const levels = { ...FRESH_PROGRESS.skillLevels, amplifyDamage: 4 };
    expect(synergyMultiplier(levels, "boneSpear")).toBe(1);
    const { percentPerSkillLevel } = firstSynergy("corpseExplosion");
    expect(synergyMultiplier(levels, "corpseExplosion")).toBeCloseTo(
      1 + (percentPerSkillLevel / 100) * 4,
    );
  });

  it("sums several Synergies", () => {
    skillTuning.boneSpear.synergies = [
      { skill: "golem", percentPerSkillLevel: 10 },
      { skill: "boneWard", percentPerSkillLevel: 5 },
    ];
    const levels = { ...FRESH_PROGRESS.skillLevels, golem: 2, boneWard: 3 };
    expect(synergyMultiplier(levels, "boneSpear")).toBeCloseTo(1 + 0.2 + 0.15);
  });
});

describe("Corpse Explosion's Synergy with Amplify Damage", () => {
  /** The burst damage with Amplify Damage at `amplify`, off the Skill Bar. */
  function burst(amplify: number): number {
    const w = inField(
      { corpseExplosion: 1, amplifyDamage: amplify },
      "corpseExplosion",
    );
    const [monster] = w.monsters;
    if (!monster) throw new Error("No Monster");
    monster.pos = { x: 6, y: 4 };
    monster.prevPos = { x: 6, y: 4 };
    monster.home = { x: 6, y: 4 };
    corpseAt(w, { x: 6, y: 4 });
    const hit = castAt(w, { x: 6, y: 4 }).find(
      (event) => event.type === "HitLanded",
    );
    if (hit?.type !== "HitLanded") throw new Error("No hit");
    return hit.damage;
  }

  it("grows the burst by the tuned % per Skill Level, with the giver off the Skill Bar", () => {
    const { effect } = skillTuning.corpseExplosion;
    if (effect.type !== "explode") throw new Error("Not a burst");
    // One fixed roll, so the two bursts compare.
    skillTuning.corpseExplosion.effect = { ...effect, share: [0.5, 0.5] };
    const { percentPerSkillLevel } = firstSynergy("corpseExplosion");
    const plain = burst(0);
    expect(burst(5)).toBe(
      Math.round(plain * (1 + (percentPerSkillLevel / 100) * 5)),
    );
  });
});

describe("Minion Synergies", () => {
  /** The Minion `skill` brings with its giver at `giverLevel`. */
  function minionWith(skill: Skill, giver: Skill, giverLevel: number) {
    const w = inField({ [skill]: 1, [giver]: giverLevel }, skill);
    corpseAt(w, { x: 5, y: 4 });
    castAt(w, { x: 5, y: 4 });
    const [minion] = w.minions;
    if (!minion) throw new Error("No Minion");
    return minion;
  }

  it.each([
    ["raiseSkeleton", "golem"],
    ["golem", "boneWard"],
  ] as const)("%s's Minion gains Life and damage per Skill Level of %s", (skill, giver) => {
    const { skill: tunedGiver, percentPerSkillLevel } = firstSynergy(skill);
    expect(tunedGiver).toBe(giver);
    const factor = 1 + (percentPerSkillLevel / 100) * 4;
    const plain = minionWith(skill, giver, 0);
    const boosted = minionWith(skill, giver, 4);

    expect(boosted.life).toBe(Math.round(minionMaxLife(plain) * factor));
    expect(minionMaxLife(boosted)).toBe(boosted.life);
    const [least, most] = minionDamageRange(plain);
    expect(minionDamageRange(boosted)).toEqual([
      Math.round(least * factor),
      Math.round(most * factor),
    ]);
  });
});
