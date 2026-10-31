import { describe, expect, it } from "vitest";
import { encodeSave, parseSave, saveOf } from "../save";
import { heroTuning } from "../tuning/hero";
import { monsterTuning } from "../tuning/monsters";
import { skillTuning } from "../tuning/skills";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import type { Vec } from "./vec";
import {
  createWorld,
  FRESH_PROGRESS,
  type Monster,
  maxMana,
  type Progress,
  type Projectile,
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
 * A Hero who spent a Skill Point a Level from Level 6 on Bone Spear, on the
 * right-click slot, with plenty of Mana and the 4 Skill Points from before
 * Level 6 unspent.
 */
function necromancer(boneSpear = 1): Progress {
  const level = 5 + boneSpear;
  return {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    energy: FRESH_PROGRESS.energy + 5 * (level - 1),
    skillPoints: 4,
    skillLevels: { ...FRESH_PROGRESS.skillLevels, boneSpear },
    skillBar: { ...emptySkillBar(), right: "boneSpear" },
  };
}

/**
 * Town by an Exit to `field`, a Combat Area of `areaLevel`: by default 8,
 * where a Skeleton outlasts a spear's hit.
 */
function areas(field: string[], areaLevel = 8) {
  return {
    town: map(["HAE"], "field", null),
    field: map(field, "town", areaLevel),
  };
}

const FIELD = areas([
  "EA..................",
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "H................SSS",
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
 * A World with the Hero just arrived in `field`, moved to `hero`, and its
 * Skeletons standing still at `at`, the rest far off.
 */
function inField(
  at: Vec[],
  {
    hero = { x: 2, y: 4 },
    progress = necromancer(),
    field = FIELD,
    seed = 1,
  } = {},
): World {
  const w = createWorld({ areas: field, seed, progress });
  step(w, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
  stepUntil(w, () => w.areaName === "field" && !w.areaChange);
  w.hero.pos = { ...hero };
  w.hero.prevPos = { ...hero };
  w.monsters.forEach((monster, i) => {
    const pos = at[i] ?? { x: 19.5, y: 7.5 };
    monster.pos = { ...pos };
    monster.prevPos = { ...pos };
    monster.home = { ...pos };
  });
  return w;
}

/** Casts Bone Spear at `target`, the step's events. */
function spearAt(w: World, target: Vec): SimEvent[] {
  return step(w, [{ type: "Cast", slot: "right", target }]);
}

/** The Bone Spear in flight, failing if there is none. */
function spearOf(w: World): Projectile {
  const spear = w.projectiles.find((p) => p.kind === "boneSpear");
  if (!spear) throw new Error("No Bone Spear in flight");
  return spear;
}

/** Steps until `spear` is gone, returning the events on the way. */
function untilGone(w: World, spear: Projectile): SimEvent[] {
  return stepUntil(w, () => !w.projectiles.includes(spear));
}

describe("casting Bone Spear", () => {
  it("spends its Mana and looses a Bone Spear from the Hero toward the cast point", () => {
    const w = inField([]);
    const mana = w.hero.mana;

    const events = spearAt(w, { x: 5, y: 8 });

    expect(events).toContainEqual({
      type: "SkillCast",
      skill: "boneSpear",
      target: { x: 5, y: 8 },
    });
    expect(w.hero.mana).toBeCloseTo(mana - skillTuning.boneSpear.manaCost, 0);
    const spear = spearOf(w);
    expect(spear.from).toBe("hero");
    expect(spear.prevPos).toEqual({ x: 2, y: 4 });
    expect(spear.direction.x).toBeCloseTo(3 / 5);
    expect(spear.direction.y).toBeCloseTo(4 / 5);
  });
});

/** How many times each Monster was hit in `events`, by id. */
function hitsOn(events: SimEvent[]): Map<Monster["id"], number[]> {
  const hits = new Map<Monster["id"], number[]>();
  for (const event of events) {
    if (event.type !== "HitLanded") continue;
    hits.set(event.target, [...(hits.get(event.target) ?? []), event.damage]);
  }
  return hits;
}

describe("Bone Spear's flight", () => {
  it("hits every Monster on its line, each exactly once, and none off it", () => {
    const w = inField([
      { x: 5, y: 4 },
      { x: 8, y: 4 },
    ]);
    const [near, far] = w.monsters;
    const off = w.monsters[2];
    off.pos = { x: 8, y: 7 };

    const events = spearAt(w, { x: 10, y: 4 });
    events.push(...untilGone(w, spearOf(w)));

    const hits = hitsOn(events);
    expect(hits.get(near.id)).toHaveLength(1);
    expect(hits.get(far.id)).toHaveLength(1);
    expect(hits.has(off.id)).toBe(false);
  });

  it("flies through the Hero's Minions without hurting them", () => {
    const progress = necromancer();
    progress.skillLevels.golem = 1;
    progress.skillBar.key1 = "golem";
    const w = inField([{ x: 7, y: 4 }], { progress });
    step(w, [{ type: "Cast", slot: "key1", target: { x: 4, y: 4 } }]);
    stepUntil(w, () => !w.hero.cast);
    const [golem] = w.minions;
    golem.pos = { x: 4, y: 4 };
    const life = golem.life;

    const events = spearAt(w, { x: 10, y: 4 });
    events.push(...untilGone(w, spearOf(w)));

    expect(events).not.toContainEqual(
      expect.objectContaining({ type: "MinionHit" }),
    );
    expect(events).not.toContainEqual(
      expect.objectContaining({ type: "MinionMissed" }),
    );
    expect(golem.life).toBe(life);
    expect(hitsOn(events).get(w.monsters[0].id)).toHaveLength(1);
  });

  it("stops at a wall, sparing the Monster beyond it", () => {
    const field = areas([
      "EA..................",
      "....................",
      "....................",
      "....................",
      "......#.............",
      "....................",
      "....................",
      "H.................SS",
    ]);
    const w = inField([{ x: 8.5, y: 4.5 }], {
      hero: { x: 2.5, y: 4.5 },
      field,
    });

    const events = spearAt(w, { x: 10.5, y: 4.5 });
    const spear = spearOf(w);
    events.push(...untilGone(w, spear));

    expect(hitsOn(events).size).toBe(0);
    expect(spear.pos.x).toBeLessThan(7);
  });

  it("vanishes at the end of its range", () => {
    const w = inField([], { hero: { x: 2, y: 2 } });

    spearAt(w, { x: 3, y: 2 });
    const spear = spearOf(w);
    untilGone(w, spear);

    expect(spear.pos.x).toBeCloseTo(2 + 12);
    expect(spear.pos.y).toBeCloseTo(2);
  });
});

describe("Bone Spear's damage", () => {
  /** Every hit a spear at `skillLevel` lands on a Skeleton in 10 casts. */
  function hits(skillLevel: number): number[] {
    const damage: number[] = [];
    for (let seed = 1; seed <= 10; seed++) {
      const progress = necromancer(skillLevel);
      const w = inField([{ x: 5, y: 4 }], { progress, seed });
      const events = spearAt(w, { x: 10, y: 4 });
      events.push(...untilGone(w, spearOf(w)));
      expect(events).not.toContainEqual(
        expect.objectContaining({ type: "Missed" }),
      );
      damage.push(...(hitsOn(events).get(w.monsters[0].id) ?? []));
    }
    return damage;
  }

  it("rolls 60–90 at Skill Level 1, never Missing whatever the Defense", () => {
    monsterTuning.skeleton.defense = 1_000_000;

    const damage = hits(1);

    expect(damage).toHaveLength(10);
    for (const one of damage) {
      expect(one).toBeGreaterThanOrEqual(60);
      expect(one).toBeLessThanOrEqual(90);
    }
  });

  it("grows by 8 each Skill Level", () => {
    const damage = hits(3);

    expect(damage).toHaveLength(10);
    for (const one of damage) {
      expect(one).toBeGreaterThanOrEqual(76);
      expect(one).toBeLessThanOrEqual(106);
    }
  });
});

describe("learning Bone Spear", () => {
  it("is open from Level 6", () => {
    expect(skillTuning.boneSpear.requiredLevel).toBe(6);
    const at = (level: number) =>
      createWorld({
        areas: FIELD,
        seed: 1,
        progress: {
          ...FRESH_PROGRESS,
          level,
          experience: heroTuning.experienceTable[level - 1],
          skillPoints: 1,
          skillLevels: { ...FRESH_PROGRESS.skillLevels, corpseExplosion: 1 },
        },
      });
    const early = at(5);
    const ready = at(6);

    step(early, [{ type: "SpendSkillPoint", skill: "boneSpear" }]);
    step(ready, [{ type: "SpendSkillPoint", skill: "boneSpear" }]);

    expect(early.hero.progress.skillLevels.boneSpear).toBe(0);
    expect(ready.hero.progress.skillLevels.boneSpear).toBe(1);
  });
});

describe("a Save", () => {
  it("keeps Bone Spear's Skill Level and Skill Bar slot", () => {
    const w = createWorld({ areas: FIELD, seed: 1, progress: necromancer(3) });

    const save = parseSave(encodeSave(saveOf(w)));

    expect(save?.progress.skillLevels.boneSpear).toBe(3);
    expect(save?.progress.skillBar.right).toBe("boneSpear");
  });
});

describe("Bone Spear's tuning", () => {
  /** The casts a Hero at Level 6 takes to kill a Monster Level 6 Skeleton. */
  function castsToKill(seed: number): number {
    const field = areas(
      [
        "EA..................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "H.................SS",
      ],
      6,
    );
    const w = inField([{ x: 5, y: 4 }], { field, seed });
    const [skeleton] = w.monsters;
    // A Monster Level 6 Skeleton: 60 Life grown by 25% a Monster Level.
    expect(skeleton.life).toBe(135);
    for (let casts = 1; casts <= 10; casts++) {
      w.hero.mana = maxMana(w);
      spearAt(w, { x: 10, y: 4 });
      untilGone(w, spearOf(w));
      stepUntil(w, () => !w.hero.cast);
      if (!w.monsters.includes(skeleton)) return casts;
      skeleton.pos = { x: 5, y: 4 };
    }
    throw new Error("Never killed");
  }

  it("kills an own-Level Skeleton in about two casts at Skill Level 1", () => {
    const casts = Array.from({ length: 20 }, (_, i) => castsToKill(i + 1));

    expect(Math.min(...casts)).toBe(2);
    expect(Math.max(...casts)).toBeLessThanOrEqual(3);
    expect(casts.filter((n) => n === 2).length).toBeGreaterThanOrEqual(10);
  });
});
