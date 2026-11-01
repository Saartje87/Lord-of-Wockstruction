import { describe, expect, it } from "vitest";
import { encodeSave, parseSave, saveOf } from "../save";
import { heroTuning } from "../tuning/hero";
import { minionTuning } from "../tuning/minions";
import { skillTuning } from "../tuning/skills";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import { distance, type Vec } from "./vec";
import {
  type Corpse,
  createWorld,
  FRESH_PROGRESS,
  minionMaxLife,
  type Progress,
  raiseCount,
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
 * A Hero with `raiseMage` Skill Levels in Raise Mage, on the right-click
 * slot, and `raiseSkeleton` in Raise Skeleton, on key 1, with plenty of Mana
 * for both.
 */
function necromancer(raiseMage: number, raiseSkeleton = 0): Progress {
  const level = Math.max(
    1 + raiseMage + raiseSkeleton,
    skillTuning.raiseMage.requiredLevel,
  );
  return {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    energy: FRESH_PROGRESS.energy + 5 * (level - 1),
    skillPoints: level - 1 - raiseMage - raiseSkeleton,
    skillLevels: { ...FRESH_PROGRESS.skillLevels, raiseMage, raiseSkeleton },
    skillBar: {
      ...emptySkillBar(),
      right: "raiseMage",
      key1: raiseSkeleton > 0 ? "raiseSkeleton" : null,
    },
  };
}

/** Town by an Exit to an open field, with the field drawn as `field`. */
function areas(field: string[]) {
  return { town: map(["HAE"], "field", null), field: map(field, "town", 1) };
}

const OPEN_FIELD = areas([
  "EA..........",
  "............",
  "............",
  "............",
  "............",
  "...........H",
]);

/** A World with the Hero in Town by an Exit to a field. */
function world(progress: Progress, fieldAreas = OPEN_FIELD): World {
  return createWorld({ areas: fieldAreas, seed: 1, progress });
}

/** Steps with no orders until `done`, failing after `limit` steps. */
function stepUntil(w: World, done: () => boolean, limit = 600): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; !done(); i++) {
    if (i > limit) throw new Error("Never happened");
    events.push(...step(w, []));
  }
  return events;
}

/** A World with the Hero just arrived in the field, at tile (1, 0). */
function inField(
  progress: Progress = necromancer(1),
  fieldAreas = OPEN_FIELD,
): World {
  const w = world(progress, fieldAreas);
  step(w, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
  stepUntil(w, () => w.areaName === "field" && !w.areaChange);
  return w;
}

/** Lays a Skeleton's Corpse at `pos`, as a kill there would. */
function corpseAt(w: World, pos: Vec, type: Corpse["type"] = "skeleton") {
  const corpse = { id: w.nextMonsterId++, type, monsterLevel: 1, pos };
  w.corpses.push(corpse);
  return corpse;
}

/** Casts Raise Mage at `target`, then waits out the cast. */
function raiseAt(w: World, target: Vec): SimEvent[] {
  const events = step(w, [{ type: "Cast", slot: "right", target }]);
  events.push(...stepUntil(w, () => !w.hero.cast));
  return events;
}

/** The Raised Mages among the Hero's Minions. */
const raisedMages = (w: World) =>
  w.minions.filter((minion) => minion.type === "raisedMage");

/** The `raise` effect's numbers, which Raise Mage is tuned with. */
function raiseNumbers() {
  const { effect } = skillTuning.raiseMage;
  if (effect.type !== "raise") throw new Error("Not a raise effect");
  return effect;
}

/** An open field with one Skeleton in it. */
const SKELETON_FIELD = areas([
  "EA..........",
  "............",
  "......S.....",
  "............",
  "............",
  "...........H",
]);

describe("casting Raise Mage", () => {
  it("hangs from Raise Skeleton in the Summoning Branch", () => {
    expect(skillTuning.raiseMage.branch).toBe("summoning");
    expect(skillTuning.raiseMage.prerequisites).toEqual(["raiseArcher"]);
  });

  it("sits in row 2 at Required Level 10 and costs Mana like Raise Archer", () => {
    const { raiseMage, raiseArcher } = skillTuning;

    expect(raiseMage.grid.row).toBe(2);
    expect(raiseMage.requiredLevel).toBe(10);
    expect(raiseMage.manaCost).toBe(raiseArcher.manaCost);
    expect(raiseMage.manaCostPerSkillLevel).toBe(
      raiseArcher.manaCostPerSkillLevel,
    );
  });

  it("raises one Raised Mage, and one more every 4 Skill Levels", () => {
    const { raiseMage } = skillTuning;
    if (raiseMage.effect.type !== "raise") throw new Error("Not a raise");

    expect(raiseCount(raiseMage.effect, 1)).toBe(1);
    expect(raiseCount(raiseMage.effect, 4)).toBe(1);
    expect(raiseCount(raiseMage.effect, 5)).toBe(2);
    expect(raiseCount(raiseMage.effect, 9)).toBe(3);
  });

  it("has Raised Mages with less Life than a Raised Skeleton, using a Skeleton's Resistances", () => {
    const mage = minionTuning.raisedMage;

    expect(mage.life).toBeLessThan(minionTuning.raisedSkeleton.life);
    expect(mage.resistancesOf).toBe("skeleton");
  });

  it("spends its Mana and raises a Raised Mage on the nearest Corpse near the cast point, using it up", () => {
    const w = inField();
    const near = corpseAt(w, { x: 5.5, y: 2.5 });
    const far = corpseAt(w, { x: 4, y: 4 });
    const mana = w.hero.mana;

    const events = step(w, [
      { type: "Cast", slot: "right", target: { x: 5, y: 3 } },
    ]);

    const [raised] = w.minions;
    expect(events).toContainEqual({
      type: "SkillCast",
      skill: "raiseMage",
      target: { x: 5, y: 3 },
    });
    expect(events).toContainEqual({
      type: "MinionSummoned",
      minion: raised?.id,
      pos: near.pos,
    });
    expect(w.minions).toEqual([
      expect.objectContaining({
        type: "raisedMage",
        skill: "raiseMage",
        pos: near.pos,
        life: minionMaxLife({ type: "raisedMage", skillLevel: 1 }),
      }),
    ]);
    expect(w.corpses).toEqual([far]);
    expect(w.hero.mana).toBeCloseTo(mana - skillTuning.raiseMage.manaCost, 0);
  });

  it("with no Corpse near the cast point spends nothing, doesn't root and names why", () => {
    const w = inField();
    const mana = w.hero.mana;

    const events = step(w, [
      { type: "Cast", slot: "right", target: { x: 5.5, y: 2.5 } },
      { type: "MoveTo", target: { x: 1.5, y: 3.5 } },
    ]);

    expect(events).toEqual([{ type: "CastFailed", reason: "corpse" }]);
    expect(w.hero.mana).toBeGreaterThanOrEqual(mana);
    expect(w.hero.cast).toBeNull();
    expect(w.minions).toEqual([]);
  });
});

describe("the Hero's Raised Mages", () => {
  /** Raises one Raised Mage for each of `count` fresh Corpses. */
  function raiseMany(w: World, count: number) {
    for (let i = 0; i < count; i++) {
      corpseAt(w, { x: 3.5 + i, y: 3.5 });
      raiseAt(w, { x: 3.5 + i, y: 3.5 });
    }
  }

  it("number at most the Skill's count, and no more", () => {
    const { count } = raiseNumbers();
    const w = inField(necromancer(1));

    raiseMany(w, count + 2);

    expect(raisedMages(w)).toHaveLength(count);
  });

  it("past that number replace the oldest, which crumbles away", () => {
    const w = inField();
    raiseMany(w, raiseNumbers().count);
    const [oldest] = w.minions;
    corpseAt(w, { x: 8.5, y: 1.5 });

    const events = raiseAt(w, { x: 8.5, y: 1.5 });

    expect(events).toContainEqual(
      expect.objectContaining({ type: "MinionCrumbled", minion: oldest?.id }),
    );
    expect(raisedMages(w)).toHaveLength(raiseNumbers().count);
    expect(w.minions.some((minion) => minion.id === oldest?.id)).toBe(false);
  });

  it("are counted apart from Raised Skeletons, neither replacing the other", () => {
    const w = inField(necromancer(1, 1));
    const { count } = raiseNumbers();
    for (let i = 0; i < count; i++) {
      corpseAt(w, { x: 3.5 + i, y: 3.5 });
      raiseAt(w, { x: 3.5 + i, y: 3.5 });
      corpseAt(w, { x: 3.5 + i, y: 4.5 });
      step(w, [{ type: "Cast", slot: "key1", target: { x: 3.5 + i, y: 4.5 } }]);
      stepUntil(w, () => !w.hero.cast);
    }

    expect(raisedMages(w)).toHaveLength(count);
    expect(
      w.minions.filter((minion) => minion.type === "raisedSkeleton"),
    ).toHaveLength(count);
  });

  it("follow the Hero through Exits", () => {
    const w = inField();
    raiseMany(w, 2);
    const ids = w.minions.map((minion) => minion.id);

    step(w, [{ type: "MoveTo", target: { x: 0.5, y: 0.5 } }]);
    stepUntil(w, () => w.areaName === "town" && !w.areaChange);

    expect(w.minions.map((minion) => minion.id)).toEqual(ids);
    for (const minion of w.minions) {
      expect(distance(minion.pos, w.hero.pos)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("are gone when the Save loads", () => {
    const w = inField();
    raiseMany(w, 2);

    const save = parseSave(encodeSave(saveOf(w)));
    if (!save) throw new Error("No Save");
    const loaded = createWorld({
      areas: OPEN_FIELD,
      seed: 1,
      progress: save.progress,
      belongings: save.belongings,
    });

    expect(loaded.minions).toEqual([]);
  });
});

describe("a Raised Mage in a fight", () => {
  it("shoots a Monster from beyond melee reach with Frost Bolts that hurt it", () => {
    const w = inField(necromancer(1), SKELETON_FIELD);
    const [skeleton] = w.monsters;
    if (!skeleton) throw new Error("No Skeleton");
    const life = skeleton.life;
    // Enough Life to outlast a one-Mage fight, which is slow.
    w.hero.life = 100000;
    corpseAt(w, { x: 10.5, y: 5.5 });
    raiseAt(w, { x: 10.5, y: 5.5 });
    const [mage] = w.minions;
    if (!mage) throw new Error("No Mage");
    let gapAtFirstBolt: number | null = null;

    stepUntil(
      w,
      () => {
        if (
          gapAtFirstBolt === null &&
          w.projectiles.some((p) => p.kind === "frostBolt")
        ) {
          gapAtFirstBolt = distance(mage.pos, skeleton.pos);
        }
        return skeleton.life < life;
      },
      60 * 120,
    );

    expect(gapAtFirstBolt).toBeGreaterThan(minionTuning.raisedSkeleton.reach);
  });

  it("looses Frost Bolts that fly through the Hero and hit the Monster past them", () => {
    const w = inField(necromancer(1), SKELETON_FIELD);
    const [skeleton] = w.monsters;
    if (!skeleton) throw new Error("No Skeleton");
    const at = { x: skeleton.pos.x - 3, y: skeleton.pos.y };
    // The Hero stands between the Mage and the Skeleton, in the Frost Bolt's way.
    w.hero.pos = { x: skeleton.pos.x - 1.5, y: skeleton.pos.y };
    w.hero.prevPos = { ...w.hero.pos };
    corpseAt(w, at);
    raiseAt(w, at);
    const events: SimEvent[] = [];
    let furthest = Number.NEGATIVE_INFINITY;
    const resolved = () =>
      events.some(
        (event) =>
          (event.type === "HitLanded" || event.type === "Missed") &&
          event.target === skeleton.id,
      );
    for (let i = 0; !resolved(); i++) {
      if (i > 60 * 20)
        throw new Error("The Frost Bolt never reached the Skeleton");
      events.push(...step(w, []));
      for (const bolt of w.projectiles) {
        if (bolt.from === "minion") furthest = Math.max(furthest, bolt.pos.x);
      }
    }

    // It was in flight past the Hero before it landed on the Skeleton.
    expect(furthest).toBeGreaterThan(w.hero.pos.x);
  });
});

describe("Synergies with Raise Mage", () => {
  /** The percent per Skill Level `giver` gives `receiver`. */
  const percent = (
    receiver: "raiseMage" | "raiseArcher",
    giver: "raiseMage" | "raiseArcher" | "leadenLimbs",
  ) =>
    skillTuning[receiver].synergies.find((one) => one.skill === giver)
      ?.percentPerSkillLevel ?? 0;

  it("raise Raised Mages' Life by 8% per Skill Level of Raise Archer and of Leaden Limbs", () => {
    expect(percent("raiseMage", "raiseArcher")).toBe(8);
    expect(percent("raiseMage", "leadenLimbs")).toBe(8);
    const w = inField(necromancer(1));
    w.hero.progress.skillLevels.raiseArcher = 3;
    w.hero.progress.skillLevels.leadenLimbs = 2;
    corpseAt(w, { x: 5.5, y: 2.5 });

    raiseAt(w, { x: 5.5, y: 2.5 });

    const boosted = minionMaxLife({
      type: "raisedMage",
      skillLevel: 1,
      synergy: 1 + (8 * 3 + 8 * 2) / 100,
    });
    expect(w.minions[0]?.life).toBe(boosted);
    expect(boosted).toBeGreaterThan(
      minionMaxLife({ type: "raisedMage", skillLevel: 1 }),
    );
  });

  it("are given by Raise Mage to Raise Archer at 8% per Skill Level", () => {
    expect(percent("raiseArcher", "raiseMage")).toBe(8);
  });
});

describe("Frost Bolts", () => {
  /** Raises a Raised Mage by the field's Skeleton and steps until it is hit. */
  function boltHits(
    setUp?: (w: World) => void,
  ): Extract<SimEvent, { type: "HitLanded" }> {
    const w = inField(necromancer(1), SKELETON_FIELD);
    setUp?.(w);
    w.hero.life = 100000;
    corpseAt(w, { x: 10.5, y: 5.5 });
    raiseAt(w, { x: 10.5, y: 5.5 });
    const [skeleton] = w.monsters;
    if (!skeleton) throw new Error("No Skeleton");
    for (let i = 0; i < 60 * 120; i++) {
      for (const event of step(w, [])) {
        if (event.type === "HitLanded" && event.attacker === "minion") {
          return event;
        }
      }
    }
    throw new Error("Never hit");
  }

  it("are straight Projectiles loosed by the Raised Mage with an Arrow's speed and range", () => {
    const { shot } = minionTuning.raisedMage;
    const arrow = minionTuning.raisedArcher.shot;

    expect(shot).toMatchObject({ projectile: "frostBolt" });
    expect(shot?.projectileSpeed).toBe(arrow?.projectileSpeed);
    expect(shot?.projectileRange).toBe(arrow?.projectileRange);
  });

  it("deal only Cold damage, which the Monster's Cold Resistance reduces", () => {
    const hit = boltHits();
    const most = minionTuning.raisedMage.damage[1];

    expect(hit.damageType).toBe("cold");
    // A Skeleton shrugs off 25% of Cold.
    expect(hit.damage).toBeLessThanOrEqual(Math.ceil(most * 0.75));
    expect(hit.damage).toBeGreaterThan(0);
  });

  it("are multiplied by a Curse on the Monster", () => {
    const plain = boltHits();
    const cursed = boltHits((w) => {
      const [skeleton] = w.monsters;
      if (!skeleton) throw new Error("No Skeleton");
      skeleton.curse = { skill: "amplifyDamage", left: 100000 };
    });

    expect(cursed.damage).toBeGreaterThan(plain.damage);
  });

  it("leave Raised Skeletons dealing Physical damage", () => {
    expect(minionTuning.raisedSkeleton.damageTypes).toBeUndefined();
    expect(minionTuning.raisedArcher.damageTypes).toBeUndefined();
    expect(minionTuning.golem.damageTypes).toBeUndefined();
  });
});

describe("Raised Mages fighting an own-Level Skeleton", () => {
  it.each([
    [12, 1],
    [16, 1],
    [20, 1],
  ])("hit it most of the time at Level %i, Skill Level %i", (level, skillLevel) => {
    const field = [
      "EA..........",
      "............",
      "......S.....",
      "............",
      "............",
      "...........H",
    ];
    const w = inField(necromancer(skillLevel), {
      town: map(["HAE"], "field", null),
      field: map(field, "town", level),
    });
    const [skeleton] = w.monsters;
    if (!skeleton) throw new Error("No Skeleton");
    // A dummy to shoot at, and a Mage that lasts the whole time.
    skeleton.life = 1e9;
    w.hero.life = 1e9;
    corpseAt(w, { x: 9.5, y: 4.5 });
    raiseAt(w, { x: 9.5, y: 4.5 });

    let hits = 0;
    let misses = 0;
    for (let i = 0; i < 60 * 300; i++) {
      for (const event of step(w, [])) {
        if (event.type === "HitLanded" && event.attacker === "minion") hits++;
        if (event.type === "Missed" && event.target === skeleton.id) misses++;
      }
      for (const minion of w.minions) minion.life = minion.maxLife;
      // The dummy never swings back: a Level 20 blow would fell the Mage.
      skeleton.cooldown = 1e9;
    }

    const rate = hits / (hits + misses);
    expect(hits + misses).toBeGreaterThan(30);
    expect(rate).toBeGreaterThan(0.6);
    expect(rate).toBeLessThan(0.92);
  });
});
