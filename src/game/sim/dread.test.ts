import { describe, expect, it } from "vitest";
import { curseLook } from "../render/curse";
import { heroTuning } from "../tuning/hero";
import { skillTuning } from "../tuning/skills";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import { distance } from "./vec";
import {
  createWorld,
  curseSteps,
  FRESH_PROGRESS,
  type Monster,
  maxLife,
  type Progress,
  step,
  type World,
} from "./world";

/**
 * A Town by an Exit to a crypt (Area Level 3) whose one row holds the
 * Hero's Entry, then floor, then one Monster `monster`.
 */
function areas(monster: "skeleton" | "skeleton_archer") {
  const layer = (name: string, data: number[]) => ({
    type: "tilelayer",
    name,
    width: 12,
    height: 1,
    data,
  });
  const map = (objects: object[]) => ({
    orientation: "orthogonal",
    width: 12,
    height: 1,
    tilewidth: 32,
    tileheight: 32,
    tilesets: [{ firstgid: 1, name: "test", tiles: [] }],
    layers: [
      layer("floor", new Array(12).fill(1)),
      layer("walls & props", new Array(12).fill(0)),
      { type: "objectgroup", name: "objects", objects },
    ],
  });
  const at = (name: string, type: string, x: number) => ({
    name,
    type,
    point: true,
    x: (x + 0.5) * 32,
    y: 16,
  });
  const exit = {
    name: "",
    type: "exit",
    x: 2 * 32,
    y: 0,
    width: 32,
    height: 32,
    properties: [
      { name: "area", type: "string", value: "crypt" },
      { name: "entry", type: "string", value: "arrive" },
    ],
  };
  return {
    town: map([at("start", "entry", 0), at("arrive", "entry", 1), exit]),
    crypt: combatArea(
      map([
        at("start", "entry", 0),
        at("arrive", "entry", 0),
        {
          ...at("", "monsterSpawn", 4),
          properties: [{ name: "monster", type: "string", value: monster }],
        },
      ]),
      3,
    ),
  };
}

/** A Level 15 Hero with Dread (and Leaden Limbs, Bone Spear, Amplify Damage) learned, Dread on the right-click slot. */
function necromancer(leadenLimbs = 1): Progress {
  const level = 15;
  return {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    energy: FRESH_PROGRESS.energy + 5 * (level - 1),
    skillPoints: 0,
    skillLevels: {
      ...FRESH_PROGRESS.skillLevels,
      amplifyDamage: 1,
      weaken: 1,
      leadenLimbs,
      dread: 1,
      boneSpear: 1,
    },
    skillBar: {
      ...emptySkillBar(),
      right: "dread",
      key1: "boneSpear",
      key2: "amplifyDamage",
    },
  };
}

/** The Hero arrived in the crypt with its one Monster. */
function inCrypt(
  monster: "skeleton" | "skeleton_archer",
  progress = necromancer(),
): World {
  const w = createWorld({ areas: areas(monster), seed: 1, progress });
  for (let i = 0; w.areaName === "town"; i++) {
    if (i > 1200) throw new Error("Never left Town");
    step(w, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
  }
  for (let i = 0; w.areaChange; i++) {
    if (i > 600) throw new Error("The Area change never ended");
    step(w, []);
  }
  return w;
}

const castAt = (w: World, slot: "key1" | "key2" | "right", monster: Monster) =>
  step(w, [{ type: "Cast", slot, target: { ...monster.pos } }]);

const gap = (w: World) => distance(w.monsters[0].pos, w.hero.pos);

const dread = skillTuning.dread.effect;
if (dread.type !== "curse" || dread.kind !== "dread") {
  throw new Error("Dread is not a dread Curse");
}

describe("Dread", () => {
  it("sits after Leaden Limbs with Leaden Limbs as its Prerequisite", () => {
    expect(skillTuning.dread.branch).toBe("curses");
    expect(skillTuning.dread.prerequisite).toBe("leadenLimbs");
  });

  it("Curses the Monsters in its circle with its own Curse", () => {
    const w = inCrypt("skeleton");
    castAt(w, "right", w.monsters[0]);
    expect(w.monsters[0].curse?.skill).toBe("dread");
  });

  it("has its own Curse mark", () => {
    expect(curseLook("dread")).not.toBe(curseLook("leadenLimbs"));
    expect(curseLook("dread")).not.toBe(curseLook("amplifyDamage"));
  });
});

describe("a Fleeing Monster", () => {
  it("moves away from the Hero", () => {
    const w = inCrypt("skeleton");
    castAt(w, "right", w.monsters[0]);
    const before = gap(w);
    for (let i = 0; i < 20; i++) step(w, []);
    expect(gap(w)).toBeGreaterThan(before + 0.5);
  });

  for (const type of ["skeleton", "skeleton_archer"] as const) {
    it(`never attacks (${type}), even cornered`, () => {
      const w = inCrypt(type);
      castAt(w, "right", w.monsters[0]);
      const left = w.monsters[0].curse?.left ?? 0;
      for (let i = 0; i < left - 5; i++) {
        w.hero.life = maxLife(w);
        const events = step(w, []);
        expect(events.some((event) => event.type === "HeroHit")).toBe(false);
        expect(w.projectiles).toHaveLength(0);
      }
    });
  }

  it("keeps Fleeing when hit", () => {
    const w = inCrypt("skeleton");
    castAt(w, "right", w.monsters[0]);
    for (let i = 0; i < 20; i++) step(w, []);
    const life = w.monsters[0].life;
    castAt(w, "key1", w.monsters[0]);
    for (let i = 0; w.monsters[0].life === life; i++) {
      if (i > 120) throw new Error("Never hit");
      step(w, []);
    }
    const hurtAt = gap(w);
    expect(w.monsters[0].curse?.skill).toBe("dread");
    for (let i = 0; i < 20; i++) step(w, []);
    expect(gap(w)).toBeGreaterThan(hurtAt);
  });

  it("takes up the fight again when the Curse ends", () => {
    const w = inCrypt("skeleton");
    castAt(w, "right", w.monsters[0]);
    const left = w.monsters[0].curse?.left ?? 0;
    for (let i = 0; i < left + 1; i++) step(w, []);
    expect(w.monsters[0].curse).toBeNull();
    const far = gap(w);
    for (let i = 0; i < 60; i++) step(w, []);
    expect(gap(w)).toBeLessThan(far);
    let hit = false;
    for (let i = 0; i < 60 * 30 && !hit; i++) {
      w.hero.life = maxLife(w);
      hit = step(w, []).some((event) => event.type === "HeroHit");
    }
    expect(hit).toBe(true);
  });

  it("stops Fleeing when a new Curse replaces Dread", () => {
    const w = inCrypt("skeleton");
    castAt(w, "right", w.monsters[0]);
    for (let i = 0; i < 20; i++) step(w, []);
    for (let i = 0; i < 40; i++) step(w, []);
    castAt(w, "key2", w.monsters[0]);
    expect(w.monsters[0].curse?.skill).toBe("amplifyDamage");
    const far = gap(w);
    for (let i = 0; i < 60; i++) step(w, []);
    expect(gap(w)).toBeLessThan(far);
  });
});

describe("Dread's duration", () => {
  it("grows by the tuned percent per Skill Level of Leaden Limbs", () => {
    const left = (leadenLimbs: number) => {
      const w = inCrypt("skeleton", necromancer(leadenLimbs));
      castAt(w, "right", w.monsters[0]);
      return w.monsters[0].curse?.left ?? 0;
    };
    const [synergy] = skillTuning.dread.synergies;
    expect(synergy.skill).toBe("leadenLimbs");
    const base = curseSteps(dread, 1);
    const grown = base * (1 + (synergy.percentPerSkillLevel / 100) * 4);
    expect(left(5)).toBeGreaterThan(left(1));
    expect(Math.abs(left(5) - grown)).toBeLessThan(base * 0.1);
  });
});
