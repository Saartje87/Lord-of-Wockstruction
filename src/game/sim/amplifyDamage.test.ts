import { describe, expect, it } from "vitest";
import { encodeSave, parseSave, saveOf } from "../save";
import { heroTuning } from "../tuning/hero";
import { skillTuning } from "../tuning/skills";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import type { Vec } from "./vec";
import {
  createWorld,
  FRESH_PROGRESS,
  type Monster,
  type Progress,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start`, `A` an Entry named `arrive`, `S` one Skeleton and `E` an Exit to
 * the other Area's `arrive`, each in the middle of its tile. A Combat Area
 * has `areaLevel`; Town has none.
 */
function map(rows: string[], exitTo: string, areaLevel: number | null) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const objects: object[] = [];
  [...cells].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") objects.push({ name: "start", type: "entry", x, y });
    if (cell === "A") objects.push({ name: "arrive", type: "entry", x, y });
    if (cell === "S") {
      objects.push({
        name: "",
        type: "monsterSpawn",
        point: true,
        x,
        y,
        properties: [{ name: "monster", type: "string", value: "skeleton" }],
      });
    }
    if (cell === "E") {
      objects.push({
        name: "",
        type: "exit",
        x: x - 16,
        y: y - 16,
        width: 32,
        height: 32,
        properties: [
          { name: "area", type: "string", value: exitTo },
          { name: "entry", type: "string", value: "arrive" },
        ],
      });
    }
  });
  const layer = (name: string, data: number[]) => ({
    type: "tilelayer",
    name,
    width,
    height,
    data,
  });
  const area = {
    orientation: "orthogonal",
    width,
    height,
    tilewidth: 32,
    tileheight: 32,
    tilesets: [
      {
        firstgid: 1,
        name: "test",
        tiles: [
          {
            id: 1,
            properties: [{ name: "blocks", type: "bool", value: true }],
          },
        ],
      },
    ],
    layers: [
      layer("floor", new Array(width * height).fill(1)),
      layer(
        "walls & props",
        [...cells].map((cell) => (cell === "#" ? 2 : 0)),
      ),
      { type: "objectgroup", name: "objects", objects },
    ],
  };
  return areaLevel === null ? area : combatArea(area, areaLevel);
}

/**
 * A Level 10 Hero who has spent `amplifyDamage` Skill Points on Amplify
 * Damage, on the right-click slot, with plenty of Mana and the rest of the
 * Skill Points unspent.
 */
function necromancer(amplifyDamage = 1): Progress {
  const level = 10;
  return {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    energy: FRESH_PROGRESS.energy + 5 * (level - 1),
    skillPoints: level - 1 - amplifyDamage,
    skillLevels: { ...FRESH_PROGRESS.skillLevels, amplifyDamage },
    skillBar: { ...emptySkillBar(), right: "amplifyDamage" },
  };
}

/** Town by an Exit to `field`, with three Skeletons far off in its corner. */
function areas(field: string[]) {
  return { town: map(["HAE"], "field", null), field: map(field, "town", 3) };
}

const FIELD = areas([
  "EA............",
  "..............",
  "..............",
  "..............",
  "..............",
  "..............",
  "..............",
  "H..........SSS",
]);

/** Steps with no orders until `done`, failing after `limit` steps. */
function stepUntil(w: World, done: () => boolean, limit = 600): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; !done(); i++) {
    if (i > limit) throw new Error("Never happened");
    events.push(...step(w, []));
  }
  return events;
}

/**
 * A World with the Hero just arrived in the field, at tile (1, 0), and its
 * three Monster Level 3 Skeletons standing still at `at`, or far off in the
 * corner.
 */
function inField(at: Vec[], progress = necromancer()): World {
  const w = createWorld({ areas: FIELD, seed: 1, progress });
  step(w, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
  stepUntil(w, () => w.areaName === "field" && !w.areaChange);
  w.monsters.forEach((monster, i) => {
    const pos = at[i] ?? { x: 13.5, y: 7.5 };
    monster.pos = { ...pos };
    monster.prevPos = { ...pos };
    monster.home = { ...pos };
  });
  return w;
}

/** Casts the right-click slot's Skill at `target`, the step's events. */
function castAt(w: World, target: Vec): SimEvent[] {
  return step(w, [{ type: "Cast", slot: "right", target }]);
}

/** The ids of the Monsters with a Curse. */
function cursed(w: World): Monster["id"][] {
  return w.monsters.filter((m) => m.curse).map((m) => m.id);
}

describe("casting Amplify Damage", () => {
  it("spends its Mana and Curses every Monster within its radius of the cast point, and no other", () => {
    const w = inField([
      { x: 5, y: 4 },
      { x: 7.5, y: 4 },
      { x: 9, y: 4 },
    ]);
    const [left, right] = w.monsters;
    const mana = w.hero.mana;

    const events = castAt(w, { x: 6, y: 4 });

    expect(events).toContainEqual({
      type: "SkillCast",
      skill: "amplifyDamage",
      target: { x: 6, y: 4 },
    });
    expect(events).toContainEqual({
      type: "CurseCast",
      skill: "amplifyDamage",
      pos: { x: 6, y: 4 },
      radius: 2,
    });
    expect(cursed(w)).toEqual([left?.id, right?.id]);
    expect(w.hero.mana).toBeCloseTo(
      mana - skillTuning.amplifyDamage.manaCost,
      0,
    );
  });
});

/**
 * The same World twice: in one, Amplify Damage cast at the Skeleton at
 * (4, 0.5) Curses it, and in the other it is cast just out of reach along
 * the same line, so the Hero turns the same way and nothing is Cursed.
 */
function twins(progress = necromancer()): [World, World] {
  const at = [{ x: 4, y: 0.5 }];
  const cursedOne = inField(at, progress);
  const plain = inField(at, progress);
  castAt(cursedOne, { x: 4, y: 0.5 });
  castAt(plain, { x: 9, y: 0.5 });
  stepUntil(cursedOne, () => !cursedOne.hero.cast);
  stepUntil(plain, () => !plain.hero.cast);
  expect(cursed(cursedOne)).toHaveLength(1);
  expect(cursed(plain)).toHaveLength(0);
  return [cursedOne, plain];
}

/**
 * The damage of the first hit landed by `attacker`, giving `orders` each
 * step, as a held button does.
 */
function firstHit(
  w: World,
  attacker: "hero" | "minion" | "skill",
  orders: Parameters<typeof step>[1] = [],
): number {
  for (let i = 0; i < 1200; i++) {
    const events = step(w, orders);
    for (const event of events) {
      if (event.type === "HitLanded" && event.attacker === attacker) {
        return event.damage;
      }
    }
  }
  throw new Error("Never hit");
}

describe("a Cursed Monster", () => {
  it("takes 1.5× damage from the Hero's swings", () => {
    const [cursedOne, plain] = twins();
    const attack = (w: World) => [
      { type: "Attack" as const, monster: w.monsters[0]?.id ?? -1 },
    ];

    const amplified = firstHit(cursedOne, "hero", attack(cursedOne));
    const damage = firstHit(plain, "hero", attack(plain));

    expect(amplified).toBe(Math.round(damage * 1.5));
  });

  it("takes 1.5× damage from Minions", () => {
    const progress = necromancer();
    progress.skillLevels.golem = 1;
    progress.skillBar.key1 = "golem";
    const [cursedOne, plain] = twins(progress);
    for (const w of [cursedOne, plain]) {
      step(w, [{ type: "Cast", slot: "key1", target: { x: 3, y: 1.5 } }]);
    }

    const amplified = firstHit(cursedOne, "minion");
    const damage = firstHit(plain, "minion");

    expect(amplified).toBe(Math.round(damage * 1.5));
  });

  it("takes 1.5× damage from Skills", () => {
    const progress = necromancer();
    progress.skillLevels.corpseExplosion = 1;
    progress.skillBar.key1 = "corpseExplosion";
    const [cursedOne, plain] = twins(progress);
    const explode = (w: World) => {
      w.corpses.push({
        id: w.nextMonsterId++,
        type: "zombie",
        monsterLevel: 3,
        pos: { x: 4, y: 1.5 },
      });
      return [
        {
          type: "Cast" as const,
          slot: "key1" as const,
          target: { x: 4, y: 1.5 },
        },
      ];
    };

    const amplified = firstHit(cursedOne, "skill", explode(cursedOne));
    const damage = firstHit(plain, "skill", explode(plain));

    expect(amplified).toBe(Math.round(damage * 1.5));
  });
});

/** One Skeleton far off in the corner, the others far from it. */
const APART = [
  { x: 13, y: 7 },
  { x: 4, y: 7 },
  { x: 6, y: 7 },
];

/** Steps (1/60 s) in `ms`. */
const steps = (ms: number) => Math.round((ms * 60) / 1000);

describe("the Curse", () => {
  it("wears off after 8 seconds at Skill Level 1", () => {
    const w = inField(APART);
    castAt(w, { x: 13, y: 7 });

    // The cast's own step is the first of them.
    for (let i = 2; i < steps(8000); i++) step(w, []);
    expect(cursed(w)).toHaveLength(1);
    step(w, []);
    expect(cursed(w)).toHaveLength(0);
  });

  it("lasts 2 seconds longer each Skill Level", () => {
    const w = inField(APART, necromancer(3));
    castAt(w, { x: 13, y: 7 });

    for (let i = 2; i < steps(12000); i++) step(w, []);
    expect(cursed(w)).toHaveLength(1);
    step(w, []);
    expect(cursed(w)).toHaveLength(0);
  });

  it("reaches further with Skill Level", () => {
    const at = [{ x: 8.5, y: 4 }];
    const atOne = inField(at, necromancer(1));
    const atThree = inField(at, necromancer(3));

    castAt(atOne, { x: 6, y: 4 });
    castAt(atThree, { x: 6, y: 4 });

    expect(cursed(atOne)).toHaveLength(0);
    expect(cursed(atThree)).toHaveLength(1);
  });

  it("is replaced by a new one, its duration starting over", () => {
    const w = inField(APART);
    castAt(w, { x: 13, y: 7 });
    for (let i = 0; i < steps(5000); i++) step(w, []);

    castAt(w, { x: 13, y: 7 });

    for (let i = 2; i < steps(8000); i++) step(w, []);
    expect(cursed(w)).toHaveLength(1);
    step(w, []);
    expect(cursed(w)).toHaveLength(0);
  });

  it("is gone from a Monster that reaches home while Returning", () => {
    const w = inField(APART);
    castAt(w, { x: 13, y: 7 });
    const [skeleton] = w.monsters;
    if (!skeleton) throw new Error("No Skeleton");
    skeleton.home = { x: 12, y: 7 };
    skeleton.state = "return";

    stepUntil(w, () => skeleton.state !== "return");

    expect(skeleton.pos).toEqual(skeleton.home);
    expect(cursed(w)).toEqual([]);
  });
});

describe("learning Amplify Damage", () => {
  it("is open from Level 2", () => {
    expect(skillTuning.amplifyDamage.requiredLevel).toBe(2);
    const at = (level: number) =>
      createWorld({
        areas: FIELD,
        seed: 1,
        progress: {
          ...FRESH_PROGRESS,
          level,
          experience: heroTuning.experienceTable[level - 1],
          skillPoints: 1,
        },
      });
    const early = at(1);
    const ready = at(2);

    step(early, [{ type: "SpendSkillPoint", skill: "amplifyDamage" }]);
    step(ready, [{ type: "SpendSkillPoint", skill: "amplifyDamage" }]);

    expect(early.hero.progress.skillLevels.amplifyDamage).toBe(0);
    expect(ready.hero.progress.skillLevels.amplifyDamage).toBe(1);
  });
});

describe("a Save", () => {
  it("keeps Amplify Damage's Skill Level and Skill Bar slot", () => {
    const w = createWorld({ areas: FIELD, seed: 1, progress: necromancer(3) });

    const save = parseSave(encodeSave(saveOf(w)));

    expect(save?.progress.skillLevels.amplifyDamage).toBe(3);
    expect(save?.progress.skillBar.right).toBe("amplifyDamage");
  });
});
