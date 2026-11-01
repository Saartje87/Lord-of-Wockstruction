import { describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { minionTuning } from "../tuning/minions";
import { skillTuning } from "../tuning/skills";
import { emptySkillBar } from "./skillBar";
import { skillNumbers } from "./skillNumbers";
import { combatArea } from "./testAreas";
import {
  createWorld,
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
const chill = minionTuning.raisedMage.shot?.chill;
if (!chill) throw new Error("The Raised Mage's Frost Bolt does not Chill");

/** Looses a Raised Mage's Frost Bolt at `monster` from a tile away, stepping until it lands. */
function boltHits(w: World, monster: Monster) {
  for (let tries = 0; tries < 40; tries++) {
    w.projectiles.push({
      kind: "frostBolt",
      pos: { x: monster.pos.x - 1, y: monster.pos.y },
      prevPos: { x: monster.pos.x - 1, y: monster.pos.y },
      direction: { x: 1, y: 0 },
      speed: 9,
      rangeLeft: 3,
      from: "minion",
      minion: { type: "raisedMage", skill: "raiseMage" },
    });
    let landed = false;
    for (let i = 0; i < 30 && w.projectiles.length; i++) {
      for (const event of step(w, [])) {
        if (event.type === "HitLanded" && event.attacker === "minion") {
          landed = true;
        }
      }
    }
    if (landed) return;
  }
  throw new Error("The Frost Bolt never hit");
}

/** The Hero, kept alive and out of the Monster's reach, with the Monster nearly at the end of its leash. */
function steps(w: World, count: number) {
  for (let i = 0; i < count; i++) {
    w.hero.life = maxLife(w);
    step(w, []);
  }
}

describe("a Frost Bolt's Chill", () => {
  it("Chills the Monster it hits for the tuned time, at the tuned paces", () => {
    const w = inCrypt("skeleton");
    const [monster] = w.monsters;
    boltHits(w, monster);
    expect(monster.chill).not.toBeNull();
    expect(monster.chill?.walkSpeed).toBe(chill.walkSpeed);
    expect(monster.chill?.attackSpeed).toBe(chill.attackSpeed);
    expect(chill.walkSpeed).toBeLessThan(1);
    expect(chill.attackSpeed).toBeLessThan(1);
    expect(chill.durationMs).toBe(1500);
  });

  it("wears off after its time", () => {
    const w = inCrypt("skeleton");
    const [monster] = w.monsters;
    monster.chill = { left: 3, walkSpeed: 0.75, attackSpeed: 0.75 };
    steps(w, 2);
    expect(monster.chill).not.toBeNull();
    steps(w, 1);
    expect(monster.chill).toBeNull();
  });

  it("starts over when another Frost Bolt hits", () => {
    const w = inCrypt("skeleton");
    const [monster] = w.monsters;
    monster.chill = { left: 2, walkSpeed: 0.75, attackSpeed: 0.75 };
    boltHits(w, monster);
    const full = Math.round(chill.durationMs / (1000 / 60));
    expect(monster.chill?.left).toBeGreaterThan(2);
    expect(monster.chill?.left).toBeLessThanOrEqual(full);
  });

  it("is kept apart from the Curse slot", () => {
    const w = inCrypt("skeleton");
    const [monster] = w.monsters;
    castAt(w, "right", monster);
    expect(monster.curse?.skill).toBe("leadenLimbs");
    boltHits(w, monster);
    expect(monster.chill).not.toBeNull();
    expect(monster.curse?.skill).toBe("leadenLimbs");
    // A new Curse leaves the Chill alone too.
    steps(w, 60);
    castAt(w, "key1", monster);
    expect(monster.curse?.skill).toBe("amplifyDamage");
    expect(monster.chill).not.toBeNull();
  });

  it("does not take a Curse's place when the Monster has none", () => {
    const w = inCrypt("skeleton");
    const [monster] = w.monsters;
    boltHits(w, monster);
    expect(monster.curse).toBeNull();
  });

  it("is lost when the Monster dies", () => {
    const w = inCrypt("skeleton");
    const [monster] = w.monsters;
    boltHits(w, monster);
    monster.life = 1;
    boltHits(w, monster);
    expect(w.monsters).not.toContain(monster);
  });

  it("leaves a Monster that gets home", () => {
    const w = inCrypt("skeleton");
    const [monster] = w.monsters;
    monster.chill = { left: 6000, walkSpeed: 0.75, attackSpeed: 0.75 };
    monster.state = "return";
    monster.pos = { x: monster.home.x + 1, y: monster.home.y };
    monster.prevPos = { ...monster.pos };
    for (let i = 0; i < 600 && monster.state === "return"; i++) steps(w, 1);
    expect(monster.state).toBe("idle");
    expect(monster.chill).toBeNull();
  });
});

/** Steps with the Hero still; how far the Monster walked in `count` steps. */
function walked(setUp: (monster: Monster) => void, count: number): number {
  const w = inCrypt("skeleton");
  const [monster] = w.monsters;
  setUp(monster);
  const from = monster.pos.x;
  steps(w, count);
  return from - monster.pos.x;
}

const chilled = (monster: Monster) => {
  monster.chill = {
    left: 6000,
    walkSpeed: chill.walkSpeed,
    attackSpeed: chill.attackSpeed,
  };
};
const cursed = (monster: Monster) => {
  monster.curse = { skill: "leadenLimbs", left: 6000 };
};

describe("a Chilled Monster", () => {
  it("walks at the tuned share of its speed", () => {
    const plain = walked(() => {}, 10);
    expect(plain).toBeGreaterThan(0.3);
    expect(walked(chilled, 10) / plain).toBeCloseTo(chill.walkSpeed, 1);
  });

  it("walks at the slower of Chilled and Leaden Limbs, not both", () => {
    const plain = walked(() => {}, 10);
    const both = walked((m) => {
      chilled(m);
      cursed(m);
    }, 10);
    const leaden = walked(cursed, 10);
    expect(Math.min(chill.walkSpeed, limbs.walkSpeed)).toBe(limbs.walkSpeed);
    expect(both / plain).toBeCloseTo(limbs.walkSpeed, 1);
    expect(both).toBeCloseTo(leaden, 5);
  });

  /** The steps between the hits on the Hero, with `setUp` applied to the Monster each step. */
  function interval(setUp: (monster: Monster) => void): number {
    const w = inCrypt("skeleton");
    const [monster] = w.monsters;
    const at: number[] = [];
    for (let i = 0; at.length < 6; i++) {
      if (i > 60 * 600) throw new Error("Too few hits");
      setUp(monster);
      w.hero.life = maxLife(w);
      for (const event of step(w, [])) {
        if (event.type === "HeroHit") at.push(i);
      }
    }
    return (at[5] - at[1]) / 4;
  }

  it("swings as often as the tuned share", () => {
    const ratio = interval(() => {}) / interval(chilled);
    expect(ratio).toBeLessThan(chill.attackSpeed + 0.15);
    expect(ratio).toBeGreaterThan(chill.attackSpeed - 0.15);
  });

  it("swings at the slower of Chilled and Leaden Limbs, not both", () => {
    const both = interval((m) => {
      chilled(m);
      cursed(m);
    });
    const leaden = interval(cursed);
    expect(Math.abs(both - leaden)).toBeLessThan(leaden * 0.1);
  });
});

describe("Raise Mage's tooltip", () => {
  it("mentions the Chill and its numbers", () => {
    const levels = necromancer().skillLevels;
    const line = skillNumbers("raiseMage", 1, levels).find(
      (one) => one.label === "Chilled",
    );
    expect(line?.text).toBe(
      "1.5 seconds, walks -25% speed, attacks -25% speed",
    );
  });
});
