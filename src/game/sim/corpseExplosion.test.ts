import { afterEach, describe, expect, it } from "vitest";
import { encodeSave, parseSave, saveOf } from "../save";
import { heroTuning } from "../tuning/hero";
import { monsterTuning } from "../tuning/monsters";
import { skillTuning } from "../tuning/skills";
import { monsterMaxLife } from "./monsters";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import { distance, type Vec } from "./vec";
import {
  type Corpse,
  createWorld,
  FRESH_PROGRESS,
  type Monster,
  maxMana,
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
 * A Hero who spent a Skill Point a Level from Level 4 on Corpse Explosion,
 * on the right-click slot, with plenty of Mana and the 2 Skill Points from
 * before Level 4 unspent.
 */
function necromancer(corpseExplosion = 1): Progress {
  const level = 3 + corpseExplosion;
  return {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    energy: FRESH_PROGRESS.energy + 5 * (level - 1),
    skillPoints: 2,
    skillLevels: { ...FRESH_PROGRESS.skillLevels, corpseExplosion },
    skillBar: { ...emptySkillBar(), right: "corpseExplosion" },
  };
}

/**
 * Town by an Exit to a field of `areaLevel`, with three Skeletons far off in
 * its corner.
 */
function areas(areaLevel = 3) {
  const field = [
    "EA............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "H..........SSS",
  ];
  return {
    town: map(["HAE"], "field", null),
    field: map(field, "town", areaLevel),
  };
}

const FIELD = areas();

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
 * three Skeletons, Monster Level 3 unless `field` says otherwise, standing
 * still at `at`.
 */
function inField(
  at: Vec[],
  progress = necromancer(),
  { field = FIELD, seed = 1 } = {},
): World {
  const w = createWorld({ areas: field, seed, progress });
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

/** Lays a Corpse at `pos`, as a kill there of a Monster at `monsterLevel`. */
function corpseAt(
  w: World,
  pos: Vec,
  type: Corpse["type"] = "skeleton",
  monsterLevel = 3,
): Corpse {
  const corpse = { id: w.nextMonsterId++, type, monsterLevel, pos };
  w.corpses.push(corpse);
  return corpse;
}

/** Casts Corpse Explosion at `target`, the step's events. */
function explodeAt(w: World, target: Vec): SimEvent[] {
  return step(w, [{ type: "Cast", slot: "right", target }]);
}

/** The damage each Monster took in `events`, by id. */
function damageTaken(events: SimEvent[]): Map<Monster["id"], number> {
  const taken = new Map<Monster["id"], number>();
  for (const event of events) {
    if (event.type === "HitLanded") taken.set(event.target, event.damage);
  }
  return taken;
}

describe("casting Corpse Explosion", () => {
  it("spends its Mana and bursts the nearest Corpse near the cast point, using it up", () => {
    const w = inField([{ x: 6, y: 4 }]);
    const near = corpseAt(w, { x: 6.5, y: 4.5 });
    const far = corpseAt(w, { x: 7.5, y: 5.5 });
    const mana = w.hero.mana;

    const events = explodeAt(w, { x: 6.5, y: 4 });

    expect(events).toContainEqual({
      type: "SkillCast",
      skill: "corpseExplosion",
      target: { x: 6.5, y: 4 },
    });
    expect(events).toContainEqual(
      expect.objectContaining({ type: "CorpseExploded", pos: near.pos }),
    );
    expect(w.corpses).not.toContainEqual(near);
    expect(w.corpses).toContainEqual(far);
    expect(w.hero.mana).toBeCloseTo(
      mana - skillTuning.corpseExplosion.manaCost,
      0,
    );
  });
});

describe("Corpse Explosion's burst", () => {
  it("hurts every Monster within its radius by 40–70% of the dead Monster's max Life at its Monster Level", () => {
    const w = inField([
      { x: 5, y: 4 },
      { x: 7, y: 4 },
      { x: 10, y: 4 },
    ]);
    const [left, right, away] = w.monsters;
    // A Monster Level 5 Zombie: 150 Life grown by 20% a Monster Level.
    expect(monsterMaxLife({ type: "zombie", monsterLevel: 5 })).toBe(270);
    corpseAt(w, { x: 6, y: 4 }, "zombie", 5);

    const taken = damageTaken(explodeAt(w, { x: 6, y: 4 }));

    for (const monster of [left, right]) {
      const damage = taken.get(monster?.id ?? -1);
      expect(damage).toBeGreaterThanOrEqual(108);
      expect(damage).toBeLessThanOrEqual(189);
    }
    expect(taken.has(away?.id ?? -1)).toBe(false);
    expect(away?.life).toBe(
      monsterMaxLife({ type: "skeleton", monsterLevel: 3 }),
    );
  });

  it("reaches further with Skill Level", () => {
    const at = [{ x: 8.3, y: 4 }];

    const atOne = inField(at, necromancer(1));
    corpseAt(atOne, { x: 6, y: 4 });
    const atThree = inField(at, necromancer(3));
    corpseAt(atThree, { x: 6, y: 4 });

    expect(damageTaken(explodeAt(atOne, { x: 6, y: 4 })).size).toBe(0);
    expect(damageTaken(explodeAt(atThree, { x: 6, y: 4 })).size).toBe(1);
  });

  it("bursts only the one Corpse, leaving others in its radius lying", () => {
    const w = inField([]);
    corpseAt(w, { x: 6, y: 4 });
    const others = [corpseAt(w, { x: 7, y: 4 }), corpseAt(w, { x: 5, y: 5 })];

    const events = explodeAt(w, { x: 6, y: 4 });

    expect(
      events.filter((event) => event.type === "CorpseExploded"),
    ).toHaveLength(1);
    expect(w.corpses).toEqual(others);
  });

  it("never hurts the Hero or their Minions", () => {
    const progress = necromancer();
    progress.skillLevels.golem = 1;
    progress.skillBar.key1 = "golem";
    const w = inField([], progress);
    step(w, [{ type: "Cast", slot: "key1", target: { x: 2, y: 1.5 } }]);
    stepUntil(w, () => !w.hero.cast);
    const [golem] = w.minions;
    const heroLife = w.hero.life;
    const golemLife = golem?.life;
    const corpse = corpseAt(w, { x: 1.5, y: 1 });
    const radius =
      skillTuning.corpseExplosion.effect.type === "explode"
        ? skillTuning.corpseExplosion.effect.radius
        : 0;
    expect(distance(golem?.pos ?? { x: 99, y: 99 }, corpse.pos)).toBeLessThan(
      radius,
    );
    expect(distance(w.hero.pos, corpse.pos)).toBeLessThan(radius);

    const events = explodeAt(w, { x: 1.5, y: 1 });

    expect(events).toContainEqual(
      expect.objectContaining({ type: "CorpseExploded" }),
    );
    expect(w.hero.life).toBe(heroLife);
    expect(golem?.life).toBe(golemLife);
    expect(events).not.toContainEqual(
      expect.objectContaining({ type: "HeroHit" }),
    );
    expect(events).not.toContainEqual(
      expect.objectContaining({ type: "MinionHit" }),
    );
  });
});

describe("Skill damage", () => {
  const { defense } = monsterTuning.skeleton;
  afterEach(() => {
    monsterTuning.skeleton.defense = defense;
  });

  it("never Misses, whatever the Monster's Defense", () => {
    monsterTuning.skeleton.defense = 1_000_000;
    for (let i = 0; i < 10; i++) {
      const w = inField([{ x: 6.5, y: 4 }]);
      corpseAt(w, { x: 6, y: 4 });

      const events = explodeAt(w, { x: 6, y: 4 });

      expect(events).not.toContainEqual(
        expect.objectContaining({ type: "Missed" }),
      );
      expect(damageTaken(events).size).toBe(1);
    }
  });

  it("kills leave a Corpse and give the Hero the Experience", () => {
    const w = inField([{ x: 6.5, y: 4 }]);
    const [skeleton] = w.monsters;
    if (!skeleton) throw new Error("No Skeleton");
    skeleton.life = 1;
    const experience = w.hero.progress.experience;
    corpseAt(w, { x: 6, y: 4 });

    const events = explodeAt(w, { x: 6, y: 4 });

    expect(events).toContainEqual({ type: "MonsterDied", id: skeleton.id });
    const gained = events.find((event) => event.type === "ExperienceGained");
    expect(gained).toBeDefined();
    expect(w.hero.progress.experience).toBeGreaterThan(experience);
    expect(w.corpses).toEqual([
      {
        id: skeleton.id,
        type: "skeleton",
        monsterLevel: 3,
        pos: { x: 6.5, y: 4 },
      },
    ]);
  });
});

describe("a failed Corpse Explosion", () => {
  it("with no Corpse near the cast point spends nothing, doesn't root and names why", () => {
    const w = inField([]);
    const away = corpseAt(w, { x: 9, y: 4 });
    const mana = w.hero.mana;

    const events = explodeAt(w, { x: 6, y: 4 });

    expect(events).toEqual([{ type: "CastFailed", reason: "corpse" }]);
    expect(w.hero.mana).toBeGreaterThanOrEqual(mana);
    expect(w.hero.cast).toBeNull();
    expect(w.corpses).toEqual([away]);
  });

  it("in Town fails as every Skill does", () => {
    const w = createWorld({ areas: FIELD, seed: 1, progress: necromancer() });

    const events = explodeAt(w, { x: 1.5, y: 0.5 });

    expect(events).toEqual([{ type: "CastFailed", reason: "town" }]);
  });
});

describe("learning Corpse Explosion", () => {
  it("is open from Level 4", () => {
    expect(skillTuning.corpseExplosion.requiredLevel).toBe(4);
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
    const early = at(3);
    const ready = at(4);

    step(early, [{ type: "SpendSkillPoint", skill: "corpseExplosion" }]);
    step(ready, [{ type: "SpendSkillPoint", skill: "corpseExplosion" }]);

    expect(early.hero.progress.skillLevels.corpseExplosion).toBe(0);
    expect(ready.hero.progress.skillLevels.corpseExplosion).toBe(1);
  });
});

describe("a Save", () => {
  it("keeps Corpse Explosion's Skill Level and Skill Bar slot", () => {
    const w = createWorld({ areas: FIELD, seed: 1, progress: necromancer(3) });

    const save = parseSave(encodeSave(saveOf(w)));

    expect(save?.progress.skillLevels.corpseExplosion).toBe(3);
    expect(save?.progress.skillBar.right).toBe("corpseExplosion");
  });
});

describe("Corpse Explosion's tuning", () => {
  /**
   * The casts a Hero at Level 4 takes to kill a Monster Level 4 Skeleton,
   * each bursting the Corpse of another.
   */
  function castsToKill(seed: number): number {
    const w = inField([{ x: 6.5, y: 4 }], necromancer(), {
      field: areas(4),
      seed,
    });
    const [skeleton] = w.monsters;
    // A Monster Level 4 Skeleton: 60 Life grown by 25% a Monster Level.
    expect(skeleton?.life).toBe(105);
    for (let casts = 1; casts <= 10; casts++) {
      w.hero.mana = maxMana(w);
      corpseAt(w, { x: 6, y: 4 }, "skeleton", 4);
      explodeAt(w, { x: 6, y: 4 });
      stepUntil(w, () => !w.hero.cast);
      if (!skeleton || !w.monsters.includes(skeleton)) return casts;
      skeleton.pos = { x: 6.5, y: 4 };
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
