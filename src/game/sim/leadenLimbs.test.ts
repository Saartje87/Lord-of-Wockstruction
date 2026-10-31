import { describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { skillTuning } from "../tuning/skills";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
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

/** A Level 10 Hero with `amplifyDamage` and one Leaden Limbs Skill Point, Leaden Limbs on the right-click slot. */
function necromancer(amplifyDamage = 1): Progress {
  const level = 10;
  return {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    energy: FRESH_PROGRESS.energy + 5 * (level - 1),
    skillPoints: 0,
    skillLevels: {
      ...FRESH_PROGRESS.skillLevels,
      amplifyDamage,
      weaken: 1,
      leadenLimbs: 1,
    },
    skillBar: {
      ...emptySkillBar(),
      right: "leadenLimbs",
      key1: "amplifyDamage",
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

const castAt = (w: World, slot: "key1" | "right", monster: Monster) =>
  step(w, [{ type: "Cast", slot, target: { ...monster.pos } }]);

const limbs = skillTuning.leadenLimbs.effect;
if (limbs.type !== "curse" || limbs.kind !== "leadenLimbs") {
  throw new Error("Leaden Limbs is not a leadenLimbs Curse");
}

describe("Leaden Limbs", () => {
  it("hangs from Amplify Damage", () => {
    expect(skillTuning.leadenLimbs.branch).toBe("curses");
    expect(skillTuning.leadenLimbs.prerequisites).toEqual(["amplifyDamage"]);
  });

  it("Curses the Monsters in its circle with its own Curse", () => {
    const w = inCrypt("skeleton");
    castAt(w, "right", w.monsters[0]);
    expect(w.monsters[0].curse?.skill).toBe("leadenLimbs");
  });
});

/** Steps cast then walked, the Hero keeping still; how far the Monster came. */
function walked(skill: "right" | "key1", steps: number): number {
  const w = inCrypt("skeleton");
  const [monster] = w.monsters;
  const from = monster.pos.x;
  castAt(w, skill, monster);
  for (let i = 0; i < steps; i++) step(w, []);
  return from - monster.pos.x;
}

describe("a Monster under Leaden Limbs", () => {
  it("walks at the tuned share of its speed", () => {
    const plain = walked("key1", 10);
    const slowed = walked("right", 10);
    expect(plain).toBeGreaterThan(0.3);
    expect(slowed / plain).toBeCloseTo(limbs.walkSpeed, 1);
  });

  /** The steps between the first two hits on the Hero. */
  function interval(
    monster: "skeleton" | "skeleton_archer",
    skill: "right" | "key1",
  ) {
    Object.assign(limbs, { durationMs: 10 * 60 * 1000 });
    const w = inCrypt(monster);
    // Walk to the Monster so it attacks soon.
    castAt(w, skill, w.monsters[0]);
    const at: number[] = [];
    for (let i = 0; at.length < 6; i++) {
      if (i > 60 * 600) throw new Error("Too few hits");
      w.hero.life = maxLife(w);
      for (const event of step(w, [])) {
        if (event.type === "HeroHit") at.push(i);
      }
    }
    return (at[5] - at[1]) / 4;
  }

  it("swings as often as the tuned share", () => {
    const ratio = interval("skeleton", "key1") / interval("skeleton", "right");
    expect(ratio).toBeLessThan(limbs.attackSpeed + 0.15);
    expect(ratio).toBeGreaterThan(limbs.attackSpeed - 0.15);
  });

  it("shoots as often as the tuned share", () => {
    const ratio =
      interval("skeleton_archer", "key1") /
      interval("skeleton_archer", "right");
    expect(ratio).toBeLessThan(limbs.attackSpeed + 0.15);
    expect(ratio).toBeGreaterThan(limbs.attackSpeed - 0.15);
  });

  it("leaves Arrows already loosed at their speed", () => {
    const fly = (skill: "right" | "key1") => {
      const w = inCrypt("skeleton_archer");
      let from: number | null = null;
      for (let i = 0; i < 60 * 60 && !w.projectiles.length; i++) step(w, []);
      expect(w.projectiles.length).toBeGreaterThan(0);
      from = w.projectiles[0].pos.x;
      castAt(w, skill, w.monsters[0]);
      step(w, []);
      return Math.abs((w.projectiles[0]?.pos.x ?? from) - from);
    };
    expect(fly("right")).toBeCloseTo(fly("key1"), 5);
  });
});

describe("Leaden Limbs' duration", () => {
  it("grows by the tuned percent per Skill Level of Weaken", () => {
    const left = (weaken: number) => {
      const progress = necromancer();
      progress.skillLevels.weaken = weaken;
      const w = inCrypt("skeleton", progress);
      const [monster] = w.monsters;
      castAt(w, "right", monster);
      return monster.curse?.left ?? 0;
    };
    const [synergy] = skillTuning.leadenLimbs.synergies;
    expect(synergy.skill).toBe("weaken");
    const base = curseSteps(limbs, 1);
    const grown = base * (1 + (synergy.percentPerSkillLevel / 100) * 4);
    expect(left(5)).toBeGreaterThan(left(1));
    expect(Math.abs(left(5) - grown)).toBeLessThan(base * 0.1);
  });
});
