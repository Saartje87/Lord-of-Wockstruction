import { describe, expect, it } from "vitest";
import { encodeSave, parseSave, saveOf } from "../save";
import { minionTuning } from "../tuning/minions";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import { distance, type Vec } from "./vec";
import {
  createWorld,
  FRESH_PROGRESS,
  type Progress,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start`, `A` an Entry named `arrive`, `S` one Skeleton and `E` an Exit to
 * the other Area's `arrive`, each in the middle of its tile. A Combat Area has `areaLevel`;
 * Town has none.
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

/** A Level 2 Hero who spent their Skill Point on the Golem, on the Skill Bar. */
const GOLEM_HERO: Progress = {
  ...FRESH_PROGRESS,
  level: 2,
  experience: 500,
  attributePoints: 5,
  skillLevels: { golem: 1 },
  skillBar: { ...emptySkillBar(), right: "golem" },
};

/**
 * Town, a strip with an Exit at its west end, and a field: a Combat Area
 * with no Monsters, a wall across most of its middle column and a walled-off
 * pocket in its south-east corner.
 */
const AREAS = {
  town: map(["EA.....H"], "field", null),
  field: map(
    [
      "EA........H.........",
      "....................",
      ".....#..............",
      ".....#..............",
      ".....#..####........",
      ".....#..#..#........",
      ".....#..#..#........",
    ],
    "town",
    1,
  ),
};

function world(progress: Progress = GOLEM_HERO, areas = AREAS): World {
  return createWorld({ areas, seed: 1, progress });
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

/** Walks the Hero to `target`, stepping until they stand there. */
function walkTo(w: World, target: Vec): SimEvent[] {
  const events = step(w, [{ type: "MoveTo", target }]);
  events.push(...stepUntil(w, () => w.hero.path.length === 0));
  return events;
}

/** A World with the Hero just arrived in the field, at tile (1, 0). */
function inField(progress?: Progress, areas = AREAS): World {
  const w = world(progress, areas);
  step(w, [{ type: "MoveTo", target: { x: 0.5, y: 0.5 } }]);
  stepUntil(w, () => w.areaName === "field" && !w.areaChange);
  return w;
}

/** Casts the Golem at `target`, then waits out the cast. */
function summonAt(w: World, target: Vec) {
  step(w, [{ type: "Cast", slot: "right", target }]);
  stepUntil(w, () => !w.hero.cast);
}

function golemOf(w: World) {
  if (!w.minion) throw new Error("No Golem");
  return w.minion;
}

const { followDistance, speed, stuckMs } = minionTuning.golem;

describe("the Golem following the Hero", () => {
  it("walks around walls after a Hero who left it behind and stops within the follow distance", () => {
    const w = inField();
    summonAt(w, { x: 3.5, y: 4.5 });
    walkTo(w, { x: 7.5, y: 1.5 });
    walkTo(w, { x: 7.5, y: 5.5 });
    const golem = golemOf(w);

    // Never further in a step than its speed: it walks, it doesn't teleport.
    let fastest = 0;
    stepUntil(w, () => {
      fastest = Math.max(fastest, distance(golem.prevPos, golem.pos));
      return golem.pos.x > 6 && distance(golem.prevPos, golem.pos) === 0;
    });
    for (let i = 0; i < 60; i++) step(w, []);

    expect(fastest).toBeLessThanOrEqual(speed / 60 + 1e-9);
    expect(distance(golem.pos, w.hero.pos)).toBeLessThanOrEqual(
      followDistance + 1e-9,
    );
    expect(golem.pos).toEqual(golem.prevPos);
  });

  it("teleports next to the Hero from further than the teleport distance", () => {
    const w = inField();
    summonAt(w, { x: 19.5, y: 6.5 });

    step(w, []);

    const golem = golemOf(w);
    expect(distance(golem.pos, w.hero.pos)).toBeLessThanOrEqual(1 + 1e-9);
    // Not sliding across the screen to get there.
    expect(golem.prevPos).toEqual(golem.pos);
  });

  it("teleports next to the Hero once stuck where it can't walk to them", () => {
    const w = inField();
    step(w, [{ type: "Cast", slot: "right", target: { x: 9.5, y: 5.5 } }]);

    const pocket = () => golemOf(w).pos.x > 9 && golemOf(w).pos.y > 5;
    for (let i = 0; i < (stuckMs * 60) / 1000; i++) {
      step(w, []);
      expect(pocket()).toBe(true);
    }
    stepUntil(w, () => !pocket(), 120);

    expect(distance(golemOf(w).pos, w.hero.pos)).toBeLessThanOrEqual(1 + 1e-9);
  });
});

/** Walks the Hero onto the Exit at tile (0, 0) and through to the other Area. */
function takeExit(w: World): SimEvent[] {
  const from = w.areaName;
  const events = step(w, [{ type: "MoveTo", target: { x: 0.5, y: 0.5 } }]);
  events.push(...stepUntil(w, () => w.areaName !== from && !w.areaChange));
  return events;
}

describe("the Golem going through Exits", () => {
  it("arrives next to the Hero at the Entry, in Town and back out of it", () => {
    const w = inField();
    summonAt(w, { x: 3.5, y: 4.5 });
    const { id } = golemOf(w);

    takeExit(w);

    expect(w.areaName).toBe("town");
    expect(golemOf(w).id).toBe(id);
    expect(distance(golemOf(w).pos, w.hero.pos)).toBeLessThanOrEqual(1 + 1e-9);
    expect(golemOf(w).prevPos).toEqual(golemOf(w).pos);

    takeExit(w);

    expect(w.areaName).toBe("field");
    expect(golemOf(w).id).toBe(id);
    expect(distance(golemOf(w).pos, w.hero.pos)).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe("the Golem when the Hero dies", () => {
  it("crumbles away", () => {
    // A field where a pack of strong Skeletons soon kills the Hero.
    const w = inField(GOLEM_HERO, {
      ...AREAS,
      field: map(["EA.H....", "..SSS...", "..SSS..."], "town", 9),
    });
    summonAt(w, { x: 6.5, y: 0.5 });
    const { id } = golemOf(w);

    // Where it stood after each step while it lived.
    let pos: Vec | null = null;
    const events = stepUntil(
      w,
      () => {
        pos = w.minion ? { ...w.minion.pos } : pos;
        return w.death !== null;
      },
      60 * 60,
    );

    expect(events).toContainEqual({ type: "MinionCrumbled", minion: id, pos });
    expect(w.minion).toBeNull();
  });
});

describe("the Golem and the Save", () => {
  it("is not kept: loading the Save starts with no Golem", () => {
    const w = inField();
    summonAt(w, { x: 4.5, y: 0.5 });
    const save = parseSave(encodeSave(saveOf(w)));

    const loaded = createWorld({
      areas: AREAS,
      seed: 2,
      progress: save?.progress,
      belongings: save?.belongings,
    });

    expect(save?.progress.skillLevels.golem).toBe(1);
    expect(loaded.minion).toBeNull();
  });
});

describe("the Hero and the Golem", () => {
  it("walks straight through the Golem", () => {
    const w = inField();
    // On the Hero's way, within its follow distance, so it stands there.
    summonAt(w, { x: 4.5, y: 0.5 });
    const golem = { ...golemOf(w).pos };

    let nearest = Number.POSITIVE_INFINITY;
    step(w, [{ type: "MoveTo", target: { x: 7.5, y: 0.5 } }]);
    stepUntil(w, () => {
      nearest = Math.min(nearest, distance(w.hero.pos, golem));
      return w.hero.path.length === 0;
    });

    expect(golemOf(w).pos).toEqual(golem);
    expect(nearest).toBeLessThan(0.1);
    expect(w.hero.pos).toEqual({ x: 7.5, y: 0.5 });
  });
});
