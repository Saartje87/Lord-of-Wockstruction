import { describe, expect, it } from "vitest";
import { encodeSave, parseSave, saveOf } from "../save";
import { heroTuning } from "../tuning/hero";
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
 * A Hero at `level` who spent a Skill Point a Level on Raise Skeleton, on
 * the right-click slot, and the Golem at `golem`, on key 1, with plenty of
 * Mana for both.
 */
function necromancer(raiseSkeleton: number, golem = 0): Progress {
  const level = 1 + raiseSkeleton + golem;
  return {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    energy: FRESH_PROGRESS.energy + 5 * (level - 1),
    skillLevels: { ...FRESH_PROGRESS.skillLevels, raiseSkeleton, golem },
    skillBar: {
      ...emptySkillBar(),
      right: "raiseSkeleton",
      key1: golem > 0 ? "golem" : null,
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

/** Casts Raise Skeleton at `target`, then waits out the cast. */
function raiseAt(w: World, target: Vec): SimEvent[] {
  const events = step(w, [{ type: "Cast", slot: "right", target }]);
  events.push(...stepUntil(w, () => !w.hero.cast));
  return events;
}

const raisedSkeletons = (w: World) =>
  w.minions.filter((minion) => minion.type === "raisedSkeleton");

describe("casting Raise Skeleton", () => {
  it("spends its Mana and raises a Raised Skeleton on the nearest Corpse near the cast point, using it up", () => {
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
      skill: "raiseSkeleton",
      target: { x: 5, y: 3 },
    });
    expect(events).toContainEqual({
      type: "MinionSummoned",
      minion: raised?.id,
      pos: near.pos,
    });
    expect(w.minions).toEqual([
      expect.objectContaining({
        type: "raisedSkeleton",
        skill: "raiseSkeleton",
        pos: near.pos,
        life: minionMaxLife({ type: "raisedSkeleton", skillLevel: 1 }),
      }),
    ]);
    expect(w.corpses).toEqual([far]);
    expect(w.hero.mana).toBeCloseTo(
      mana - skillTuning.raiseSkeleton.manaCost,
      0,
    );
  });

  it("ignores Corpses further than about 2 tiles from the cast point", () => {
    const w = inField();
    const away = corpseAt(w, { x: 5.5, y: 2.5 });

    const events = step(w, [
      { type: "Cast", slot: "right", target: { x: 8, y: 2.5 } },
    ]);

    expect(events).toEqual([{ type: "CastFailed", reason: "corpse" }]);
    expect(w.corpses).toEqual([away]);
  });

  it("raises the same Raised Skeleton from any Monster's Corpse", () => {
    const w = inField();
    corpseAt(w, { x: 5.5, y: 2.5 }, "zombie");
    corpseAt(w, { x: 8.5, y: 2.5 }, "skeleton_archer");

    raiseAt(w, { x: 5.5, y: 2.5 });
    raiseAt(w, { x: 8.5, y: 2.5 });

    expect(w.minions.map((minion) => minion.type)).toEqual([
      "raisedSkeleton",
      "raisedSkeleton",
    ]);
  });
});

describe("a failed Raise Skeleton", () => {
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
    expect(w.hero.pos.y).toBeGreaterThan(0.5);
    expect(w.minions).toEqual([]);
  });

  it("in Town fails as every Skill does", () => {
    const w = world(necromancer(1));

    const events = step(w, [
      { type: "Cast", slot: "right", target: { x: 1.5, y: 0.5 } },
    ]);

    expect(events).toEqual([{ type: "CastFailed", reason: "town" }]);
  });
});

describe("the Hero's Raised Skeletons", () => {
  /** Raises one Raised Skeleton for each of `count` fresh Corpses. */
  function raiseMany(w: World, count: number) {
    for (let i = 0; i < count; i++) {
      corpseAt(w, { x: 3.5 + i, y: 3.5 });
      raiseAt(w, { x: 3.5 + i, y: 3.5 });
    }
  }

  it.each([
    [1, 2],
    [3, 2],
    [4, 3],
    [7, 4],
  ])("number at most 2 + one every 3 Skill Levels: at Skill Level %i, %i", (skillLevel, count) => {
    const w = inField(necromancer(skillLevel));

    raiseMany(w, count + 2);

    expect(raisedSkeletons(w)).toHaveLength(count);
  });

  it("past that number replace the oldest, which crumbles away", () => {
    const w = inField();
    raiseMany(w, 2);
    const [oldest, newer] = w.minions;
    corpseAt(w, { x: 8.5, y: 1.5 });

    const events = raiseAt(w, { x: 8.5, y: 1.5 });

    expect(events).toContainEqual(
      expect.objectContaining({ type: "MinionCrumbled", minion: oldest?.id }),
    );
    const [kept, raised] = w.minions;
    expect(w.minions).toHaveLength(2);
    expect(kept?.id).toBe(newer?.id);
    expect(events).toContainEqual({
      type: "MinionSummoned",
      minion: raised?.id,
      pos: { x: 8.5, y: 1.5 },
    });
  });

  it("grow in Life with Raise Skeleton's Skill Level", () => {
    expect(
      minionMaxLife({ type: "raisedSkeleton", skillLevel: 4 }),
    ).toBeGreaterThan(minionMaxLife({ type: "raisedSkeleton", skillLevel: 1 }));
  });

  it("are counted apart from the Golem, so both can be out at once", () => {
    const w = inField(necromancer(1, 1));
    step(w, [{ type: "Cast", slot: "key1", target: { x: 8.5, y: 4.5 } }]);
    stepUntil(w, () => !w.hero.cast);

    raiseMany(w, 3);

    expect(w.minions.map((minion) => minion.type).sort()).toEqual([
      "golem",
      "raisedSkeleton",
      "raisedSkeleton",
    ]);
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

  it("give the Hero the Experience for their kills", () => {
    const w = inField(
      necromancer(1),
      areas([
        "EA..........",
        "............",
        "......S.....",
        "............",
        "............",
        "...........H",
      ]),
    );
    const experience = w.hero.progress.experience;
    const [skeleton] = w.monsters;
    raiseMany(w, 2);

    const events = stepUntil(w, () => w.monsters.length === 0, 60 * 120);

    expect(
      events.some(
        (event) => event.type === "HitLanded" && event.attacker === "minion",
      ),
    ).toBe(true);
    expect(events).toContainEqual({ type: "ExperienceGained", amount: 100 });
    expect(w.hero.progress.experience).toBe(experience + 100);
    expect(w.corpses).toEqual([expect.objectContaining({ id: skeleton?.id })]);
  });
});

describe("learning Raise Skeleton", () => {
  it("is open from Level 1 and puts it on the Skill Bar, ready to cast", () => {
    const w = inField({
      ...FRESH_PROGRESS,
      level: 2,
      experience: 500,
      attributePoints: 5,
      skillPoints: 1,
    });
    expect(skillTuning.raiseSkeleton.requiredLevel).toBe(1);

    const events = step(w, [
      { type: "SpendSkillPoint", skill: "raiseSkeleton" },
    ]);
    corpseAt(w, { x: 5.5, y: 2.5 });
    raiseAt(w, { x: 5.5, y: 2.5 });

    expect(events).toContainEqual({
      type: "SkillLevelRaised",
      skill: "raiseSkeleton",
      skillLevel: 1,
    });
    expect(w.minions).toEqual([
      expect.objectContaining({ type: "raisedSkeleton" }),
    ]);
  });
});
