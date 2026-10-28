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
  isInCombat,
  isRegenerating,
  type Progress,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start`, `A` an Entry named `arrive`, `S` one Skeleton, `R` one Skeleton
 * Archer and `E` an Exit to the other Area's `arrive`, each in the middle of
 * its tile. A Combat Area has `areaLevel`; Town has none.
 */
function map(rows: string[], exitTo: string, areaLevel: number | null) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const objects: object[] = [];
  const spawn = (monster: string, x: number, y: number) => ({
    name: "",
    type: "monsterSpawn",
    point: true,
    x,
    y,
    properties: [{ name: "monster", type: "string", value: monster }],
  });
  [...cells].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") objects.push({ name: "start", type: "entry", x, y });
    if (cell === "A") objects.push({ name: "arrive", type: "entry", x, y });
    if (cell === "S") objects.push(spawn("skeleton", x, y));
    if (cell === "R") objects.push(spawn("skeleton_archer", x, y));
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
 * A Level 10 Hero who has spent `boneWard` Skill Points on Bone Ward, on the
 * right-click slot, with plenty of Mana and the rest of the Skill Points
 * unspent.
 */
function necromancer(boneWard = 1): Progress {
  const level = 10;
  return {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    energy: FRESH_PROGRESS.energy + 5 * (level - 1),
    skillPoints: level - 1 - boneWard,
    skillLevels: { ...FRESH_PROGRESS.skillLevels, boneWard },
    skillBar: { ...emptySkillBar(), right: "boneWard" },
  };
}

/** Town by an Exit to `field`. */
function areas(field: string[]) {
  return { town: map(["HAE"], "field", null), field: map(field, "town", 3) };
}

/** A field with a Skeleton and a Skeleton Archer far off in its corner. */
const FIELD = areas([
  "EA............",
  "..............",
  "..............",
  "..............",
  "..............",
  "..............",
  "..............",
  "H...........SR",
]);

/** Steps with `orders` each step until `done`, failing after `limit` steps. */
function stepUntil(
  w: World,
  done: () => boolean,
  limit = 600,
  orders: Parameters<typeof step>[1] = [],
): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; !done(); i++) {
    if (i > limit) throw new Error("Never happened");
    events.push(...step(w, orders));
  }
  return events;
}

/**
 * A World with the Hero just arrived in the field, at (1.5, 0.5), its
 * Skeleton standing still at `skeleton` and its Skeleton Archer at `archer`,
 * each far off in the corner if not given.
 */
function inField(
  { skeleton, archer }: { skeleton?: Vec; archer?: Vec } = {},
  progress = necromancer(),
  seed = 1,
): World {
  const w = createWorld({ areas: FIELD, seed, progress });
  step(w, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
  stepUntil(w, () => w.areaName === "field" && !w.areaChange);
  const [melee, ranged] = w.monsters;
  for (const [monster, pos] of [
    [melee, skeleton ?? { x: 12.5, y: 7.5 }],
    [ranged, archer ?? { x: 13.5, y: 7.5 }],
  ] as const) {
    monster.pos = { ...pos };
    monster.prevPos = { ...pos };
    monster.home = { ...pos };
  }
  return w;
}

/** Casts the right-click slot's Skill at the Hero's feet, the step's events. */
function cast(w: World): SimEvent[] {
  return step(w, [{ type: "Cast", slot: "right", target: { ...w.hero.pos } }]);
}

/** Casts Bone Ward and steps until the cast has ended. */
function castAndWait(w: World) {
  cast(w);
  stepUntil(w, () => !w.hero.cast);
}

/** Steps until a Monster's attack lands on the Hero, returning that hit. */
function nextHeroHit(w: World) {
  for (let i = 0; i < 1200; i++) {
    for (const event of step(w, [])) {
      if (event.type === "HeroHit") return event;
    }
  }
  throw new Error("Never hit");
}

describe("casting Bone Ward", () => {
  it("spends its Mana and puts a Bone Ward of 20 on the Hero", () => {
    const w = inField();
    const mana = w.hero.mana;
    expect(w.hero.boneWard).toBeNull();

    const events = cast(w);

    expect(events).toContainEqual({
      type: "SkillCast",
      skill: "boneWard",
      target: { x: 1.5, y: 0.5 },
    });
    expect(w.hero.boneWard).toEqual({ left: 20, full: 20 });
    expect(w.hero.mana).toBeCloseTo(mana - skillTuning.boneWard.manaCost, 0);
  });

  it("grows by 10 each Skill Level", () => {
    const w = inField({}, necromancer(3));

    cast(w);

    expect(w.hero.boneWard).toEqual({ left: 40, full: 40 });
  });

  it("fills a used Bone Ward back up to full, never above", () => {
    const w = inField({ skeleton: { x: 2.5, y: 0.5 } });
    castAndWait(w);
    nextHeroHit(w);
    expect(w.hero.boneWard?.left).toBeLessThan(20);

    castAndWait(w);
    expect(w.hero.boneWard).toEqual({ left: 20, full: 20 });

    castAndWait(w);
    expect(w.hero.boneWard).toEqual({ left: 20, full: 20 });
  });

  it("fills to the current Skill Level's full amount", () => {
    const w = inField();
    castAndWait(w);

    step(w, [{ type: "SpendSkillPoint", skill: "boneWard" }]);
    castAndWait(w);

    expect(w.hero.boneWard).toEqual({ left: 30, full: 30 });
  });
});

describe("a Bone Ward", () => {
  it("soaks a Monster's swing before the Hero's Life", () => {
    const w = inField({ skeleton: { x: 2.5, y: 0.5 } });
    castAndWait(w);
    const life = w.hero.life;

    const hit = nextHeroHit(w);

    expect(hit.damage).toBe(0);
    expect(hit.warded).toBeGreaterThan(0);
    expect(w.hero.life).toBe(life);
    expect(w.hero.boneWard?.left).toBe(20 - hit.warded);
  });

  it("soaks an Arrow before the Hero's Life", () => {
    const w = inField({ archer: { x: 7.5, y: 0.5 } });
    castAndWait(w);
    const life = w.hero.life;

    const hit = nextHeroHit(w);

    expect(w.projectiles).toEqual([]);
    expect(hit.damage).toBe(0);
    expect(hit.warded).toBeGreaterThan(0);
    expect(w.hero.life).toBe(life);
    expect(w.hero.boneWard?.left).toBe(20 - hit.warded);
  });

  it("keeps the Hero In Combat when it soaks a hit whole, so their Life doesn't regenerate", () => {
    const w = inField({ skeleton: { x: 2.5, y: 0.5 } });
    castAndWait(w);
    w.hero.life = 50;

    const hit = nextHeroHit(w);
    for (let i = 0; i < 10; i++) step(w, []);

    expect(hit.damage).toBe(0);
    expect(isInCombat(w)).toBe(true);
    expect(isRegenerating(w)).toBe(false);
    expect(w.hero.life).toBe(50);
  });

  it("can flinch the Hero when it soaks a hit whole", () => {
    // A hit flinches the Hero by chance, so no one seed is sure to flinch
    // them: find one that does, soaking the hit whole.
    const flinchedBy = (seed: number) => {
      const w = inField({ skeleton: { x: 2.5, y: 0.5 } }, necromancer(), seed);
      castAndWait(w);
      const hit = nextHeroHit(w);
      return hit.damage === 0 && w.hero.flinch > 0;
    };
    const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

    expect(seeds.some(flinchedBy)).toBe(true);
  });

  it("lets only what's left over of a hit through to Life, and is gone once used up", () => {
    const w = inField({ skeleton: { x: 2.5, y: 0.5 } });
    castAndWait(w);
    const ward = w.hero.boneWard;
    if (!ward) throw new Error("No Bone Ward");
    ward.left = 1;
    const life = w.hero.life;

    const hit = nextHeroHit(w);

    expect(hit.warded).toBe(1);
    expect(hit.damage).toBeGreaterThan(0);
    expect(w.hero.life).toBe(life - hit.damage);
    expect(w.hero.boneWard).toBeNull();
  });

  it("stays on through an Exit", () => {
    const w = inField();
    castAndWait(w);

    stepUntil(w, () => w.areaName === "town" && !w.areaChange, 600, [
      { type: "MoveTo", target: { x: 0.5, y: 0.5 } },
    ]);

    expect(w.hero.boneWard).toEqual({ left: 20, full: 20 });
  });

  it("is gone on the Hero's Death", () => {
    const w = inField({ skeleton: { x: 2.5, y: 0.5 } });
    castAndWait(w);
    const ward = w.hero.boneWard;
    if (!ward) throw new Error("No Bone Ward");
    ward.left = 1;
    w.hero.life = 1;

    stepUntil(w, () => w.death !== null, 1200);

    expect(w.hero.boneWard).toBeNull();
  });

  it("is absent after loading the Save", () => {
    const w = inField();
    castAndWait(w);
    const save = parseSave(encodeSave(saveOf(w)));
    if (!save) throw new Error("No Save");

    const loaded = createWorld({
      areas: FIELD,
      seed: 1,
      progress: save.progress,
      belongings: save.belongings,
    });

    expect(loaded.hero.boneWard).toBeNull();
  });
});

describe("learning Bone Ward", () => {
  it("is open from Level 3", () => {
    expect(skillTuning.boneWard.requiredLevel).toBe(3);
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
    const early = at(2);
    const ready = at(3);

    step(early, [{ type: "SpendSkillPoint", skill: "boneWard" }]);
    step(ready, [{ type: "SpendSkillPoint", skill: "boneWard" }]);

    expect(early.hero.progress.skillLevels.boneWard).toBe(0);
    expect(ready.hero.progress.skillLevels.boneWard).toBe(1);
  });
});

describe("a Save", () => {
  it("keeps Bone Ward's Skill Level and Skill Bar slot", () => {
    const w = createWorld({ areas: FIELD, seed: 1, progress: necromancer(3) });

    const save = parseSave(encodeSave(saveOf(w)));

    expect(save?.progress.skillLevels.boneWard).toBe(3);
    expect(save?.progress.skillBar.right).toBe("boneWard");
  });
});
