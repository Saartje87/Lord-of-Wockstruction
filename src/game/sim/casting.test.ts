import { describe, expect, it } from "vitest";
import { skillTuning } from "../tuning/skills";
import { emptySkillBar, type SkillBarSlot } from "./skillBar";
import { combatArea } from "./testAreas";
import type { Vec } from "./vec";
import {
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
 * `start`, `A` an Entry named `arrive` and `E` an Exit to the other Area's
 * `arrive`, each in the middle of its tile. A Combat Area has `areaLevel`;
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
 * A World with the Hero in Town by an Exit to a field, a Combat Area with no
 * Monsters and a block of wall at its middle.
 */
function world(progress: Progress = GOLEM_HERO): World {
  return createWorld({
    areas: {
      town: map(["HAE"], "field", null),
      field: map(
        ["EA.....", ".......", "..###..", "..###..", "..###..", "......H"],
        "town",
        1,
      ),
    },
    seed: 1,
    progress,
  });
}

/** A World with the Hero just arrived in the field, at tile (1, 0). */
function inField(progress?: Progress): World {
  const w = world(progress);
  for (let i = 0; w.areaName === "town" || w.areaChange; i++) {
    if (i > 600) throw new Error("Never got to the field");
    step(
      w,
      w.areaChange ? [] : [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }],
    );
  }
  return w;
}

function cast(w: World, target: Vec, slot: SkillBarSlot = "right"): SimEvent[] {
  return step(w, [{ type: "Cast", slot, target }]);
}

describe("casting the Golem", () => {
  it("spends its Mana cost and summons a Golem at the cast point", () => {
    const w = inField();
    const mana = w.hero.mana;

    const events = cast(w, { x: 5.5, y: 1.5 });

    expect(events).toContainEqual({
      type: "SkillCast",
      skill: "golem",
      target: { x: 5.5, y: 1.5 },
    });
    expect(events).toContainEqual({
      type: "MinionSummoned",
      minion: w.minions[0]?.id,
      pos: { x: 5.5, y: 1.5 },
    });
    expect(w.hero.mana).toBeCloseTo(mana - 15, 0);
    expect(w.minions[0]).toMatchObject({
      type: "golem",
      pos: { x: 5.5, y: 1.5 },
    });
    expect(w.minions[0]?.life).toBe(
      minionMaxLife({ type: "golem", skillLevel: 1 }),
    );
  });

  it("roots the Hero for the cast time, then runs the newest order given", () => {
    const w = inField();
    const at = { ...w.hero.pos };
    cast(w, { x: 5.5, y: 1.5 });

    const castSteps = Math.round((skillTuning.golem.castMs * 60) / 1000);
    for (let i = 1; i < castSteps - 1; i++) {
      const target = i === 1 ? { x: 6.5, y: 0.5 } : { x: 1.5, y: 1.5 };
      step(w, i < 3 ? [{ type: "MoveTo", target }] : []);
      expect(w.hero.pos).toEqual(at);
    }
    step(w, []);
    expect(w.hero.pos).toEqual(at);
    step(w, []);

    // Walking to the newest order's (1.5, 1.5), straight down from (1.5, 0.5).
    expect(w.hero.pos.x).toBeCloseTo(1.5);
    expect(w.hero.pos.y).toBeGreaterThan(at.y);
  });

  it("turns the Hero towards the cast point", () => {
    const w = inField();

    cast(w, { x: 1.5, y: 5.5 });

    expect(w.hero.facing).toBeCloseTo(Math.PI / 2);
  });

  it("summons the Golem at the nearest walkable point to a wall", () => {
    const w = inField();

    // The middle of the block of wall, 1.5 tiles from its edges.
    cast(w, { x: 3.5, y: 3.5 });

    const pos = w.minions[0]?.pos as Vec;
    const area = w.areas[w.areaName];
    expect(
      area.walkable[Math.floor(pos.y) * area.width + Math.floor(pos.x)],
    ).toBe(true);
    expect(Math.hypot(pos.x - 3.5, pos.y - 3.5)).toBeLessThan(2);
  });

  it("crumbles the living Golem and summons a fresh one at full Life", () => {
    const w = inField({ ...GOLEM_HERO, energy: 40, attributePoints: 0 });
    cast(w, { x: 5.5, y: 1.5 });
    const [old] = w.minions;
    if (!old) throw new Error("No Golem");
    old.life = 1;
    const mana = w.hero.mana;
    for (let i = 0; i < 60; i++) step(w, []);
    // It walked after the Hero meanwhile.
    const oldPos = { ...old.pos };

    const events = cast(w, { x: 1.5, y: 5.5 });

    expect(events).toContainEqual({
      type: "MinionCrumbled",
      minion: old.id,
      pos: oldPos,
    });
    expect(w.minions).toHaveLength(1);
    expect(w.minions[0]?.id).not.toBe(old.id);
    expect(w.minions[0]).toMatchObject({ pos: { x: 1.5, y: 5.5 } });
    expect(w.minions[0]?.life).toBe(
      minionMaxLife({ type: "golem", skillLevel: 1 }),
    );
    // 60 steps of regeneration, then the cost again.
    expect(w.hero.mana).toBeCloseTo(mana + 2 - 15, 0);
  });
});

describe("a failed cast", () => {
  it("in Town spends nothing, doesn't root and names why", () => {
    const w = world();
    const mana = w.hero.mana;

    const events = step(w, [
      { type: "Cast", slot: "right", target: { x: 1.5, y: 0.5 } },
      { type: "MoveTo", target: { x: 1.5, y: 0.5 } },
    ]);

    expect(events).toEqual([{ type: "CastFailed", reason: "town" }]);
    expect(w.hero.mana).toBe(mana);
    expect(w.minions).toEqual([]);
    expect(w.hero.pos.x).toBeGreaterThan(0.5);
  });

  it("without enough Mana spends nothing, doesn't root and names why", () => {
    const w = inField();
    w.hero.mana = 14;

    const events = step(w, [
      { type: "Cast", slot: "right", target: { x: 5.5, y: 1.5 } },
      { type: "MoveTo", target: { x: 1.5, y: 1.5 } },
    ]);

    expect(events).toEqual([{ type: "CastFailed", reason: "mana" }]);
    expect(w.hero.mana).toBeCloseTo(14 + 2 / 60);
    expect(w.minions).toEqual([]);
    expect(w.hero.pos.y).toBeGreaterThan(0.5);
  });

  it("from an empty slot does nothing at all", () => {
    const w = inField();
    const mana = w.hero.mana;

    expect(cast(w, { x: 5.5, y: 1.5 }, "key1")).toEqual([]);
    expect(w.hero.mana).toBe(mana);
    expect(w.minions).toEqual([]);
  });

  it("from an empty slot during a cast keeps the order given before it", () => {
    const w = inField();
    const at = { ...w.hero.pos };
    cast(w, { x: 5.5, y: 1.5 });
    step(w, [{ type: "MoveTo", target: { x: 1.5, y: 1.5 } }]);

    cast(w, { x: 6.5, y: 0.5 }, "key1");
    const castSteps = Math.round((skillTuning.golem.castMs * 60) / 1000);
    for (let i = 0; i < castSteps; i++) step(w, []);

    // Walking to the MoveTo's (1.5, 1.5), straight down from (1.5, 0.5).
    expect(w.hero.pos.x).toBeCloseTo(1.5);
    expect(w.hero.pos.y).toBeGreaterThan(at.y);
  });

  it("from a keyed slot casts its Skill", () => {
    const w = inField({
      ...GOLEM_HERO,
      skillBar: { ...emptySkillBar(), key3: "golem" },
    });

    cast(w, { x: 5.5, y: 1.5 }, "key3");

    expect(w.minions[0]).toMatchObject({ pos: { x: 5.5, y: 1.5 } });
  });
});
