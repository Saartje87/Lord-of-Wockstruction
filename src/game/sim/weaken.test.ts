import { afterEach, describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { skillTuning } from "../tuning/skills";
import { monsterDamageRange } from "./monsters";
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
    width: 6,
    height: 1,
    data,
  });
  const map = (objects: object[]) => ({
    orientation: "orthogonal",
    width: 6,
    height: 1,
    tilewidth: 32,
    tileheight: 32,
    tilesets: [{ firstgid: 1, name: "test", tiles: [] }],
    layers: [
      layer("floor", new Array(6).fill(1)),
      layer("walls & props", new Array(6).fill(0)),
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

/** A Level 10 Hero with `amplifyDamage` and one Weaken Skill Point, Weaken on the right-click slot. */
function necromancer(amplifyDamage = 1): Progress {
  const level = 10;
  return {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    energy: FRESH_PROGRESS.energy + 5 * (level - 1),
    skillPoints: 0,
    skillLevels: { ...FRESH_PROGRESS.skillLevels, amplifyDamage, weaken: 1 },
    skillBar: { ...emptySkillBar(), right: "weaken", key1: "amplifyDamage" },
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

/**
 * The damage of the first `count` hits on the Hero, the Hero never dying, or
 * of the hits before the first Monster's Curse wears off if it has one.
 */
function hitsOnHero(w: World, count: number): number[] {
  const damage: number[] = [];
  const cursed = w.monsters[0].curse !== null;
  for (let i = 0; damage.length < count; i++) {
    if (cursed && !w.monsters[0].curse) break;
    if (i > 60 * 600) throw new Error("Too few hits");
    w.hero.life = maxLife(w);
    for (const event of step(w, [])) {
      if (event.type === "HeroHit") damage.push(event.damage);
    }
  }
  return damage;
}

const weaken = skillTuning.weaken.effect;
if (weaken.type !== "curse" || weaken.kind !== "weaken") {
  throw new Error("Weaken is not a weaken Curse");
}
const tuned = { ...weaken };
afterEach(() => {
  Object.assign(weaken, tuned);
});

describe("casting Weaken", () => {
  it("Curses the Monsters in its circle and spends Mana", () => {
    const w = inCrypt("skeleton");
    const [monster] = w.monsters;
    const mana = w.hero.mana;

    const events = castAt(w, "right", monster);

    expect(events).toContainEqual(
      expect.objectContaining({ type: "CurseCast", skill: "weaken" }),
    );
    expect(monster.curse?.skill).toBe("weaken");
    expect(w.hero.mana).toBeCloseTo(mana - skillTuning.weaken.manaCost, 0);
  });

  it("can't be cast in Town", () => {
    const w = createWorld({
      areas: areas("skeleton"),
      seed: 1,
      progress: necromancer(),
    });
    const events = step(w, [
      { type: "Cast", slot: "right", target: { x: 1.5, y: 0.5 } },
    ]);
    expect(events).toContainEqual({ type: "CastFailed", reason: "town" });
  });
});

describe("a Weakened Monster", () => {
  const share = weaken.damageDealt;

  it("swings for the tuned share of its damage", () => {
    const plain = inCrypt("skeleton");
    const [min, max] = monsterDamageRange(plain.monsters[0]);
    const unweakened = hitsOnHero(plain, 30);

    const w = inCrypt("skeleton");
    castAt(w, "right", w.monsters[0]);
    const weakened = hitsOnHero(w, 30);
    expect(weakened.length).toBeGreaterThanOrEqual(3);

    expect(Math.max(...unweakened)).toBeGreaterThan(Math.round(max * share));
    for (const damage of weakened) {
      expect(damage).toBeGreaterThanOrEqual(
        Math.max(1, Math.round(min * share)),
      );
      expect(damage).toBeLessThanOrEqual(Math.round(max * share));
    }
  });

  it("looses Arrows for the tuned share of its damage", () => {
    const plain = inCrypt("skeleton_archer");
    const [, max] = monsterDamageRange(plain.monsters[0]);
    const unweakened = hitsOnHero(plain, 30);

    const w = inCrypt("skeleton_archer");
    castAt(w, "right", w.monsters[0]);
    const weakened = hitsOnHero(w, 30);
    expect(weakened.length).toBeGreaterThanOrEqual(3);

    expect(Math.max(...unweakened)).toBeGreaterThan(Math.round(max * share));
    expect(Math.max(...weakened)).toBeLessThanOrEqual(Math.round(max * share));
  });
});

describe("Curses replacing each other", () => {
  it("Weaken replaces Amplify Damage and is replaced by it", () => {
    const w = inCrypt("skeleton");
    const [monster] = w.monsters;
    castAt(w, "key1", monster);
    expect(monster.curse?.skill).toBe("amplifyDamage");
    for (let i = 0; i < 40; i++) step(w, []);
    castAt(w, "right", monster);
    expect(monster.curse?.skill).toBe("weaken");
    for (let i = 0; i < 40; i++) step(w, []);
    castAt(w, "key1", monster);
    expect(monster.curse?.skill).toBe("amplifyDamage");
  });
});

describe("Weaken's duration", () => {
  it("grows by the tuned percent per Skill Level of Amplify Damage", () => {
    const left = (amplify: number) => {
      const w = inCrypt("skeleton", necromancer(amplify));
      const [monster] = w.monsters;
      castAt(w, "right", monster);
      return monster.curse?.left ?? 0;
    };
    const [synergy] = skillTuning.weaken.synergies;
    expect(synergy.skill).toBe("amplifyDamage");
    const base = curseSteps(weaken, 1);
    const grown = base * (1 + (synergy.percentPerSkillLevel / 100) * 4);

    expect(left(5)).toBeGreaterThan(left(1));
    // A few steps of the cast itself have already worn the Curse down.
    expect(Math.abs(left(5) - grown)).toBeLessThan(base * 0.1);
  });
});
