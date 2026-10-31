import { describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { skillTuning, type WallEffect } from "../tuning/skills";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import type { Vec } from "./vec";
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
 * `start`, `A` an Entry named `arrive`, `E` an Exit to `exitTo`'s `arrive`,
 * `S` one Skeleton and `R` one Skeleton Archer, each in the middle of its
 * tile.
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

const OPEN = [
  "EA..................",
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "H...................",
];

/** A corridor one tile wide, a Bone Wall's one piece sealing it. */
const CORRIDOR = [
  "####################",
  "EAH.................",
  "####################",
];

/** A corridor three tiles wide, which a Bone Wall of three tiles seals. */
const WIDE = [
  "####################",
  "EA..................",
  "H...................",
  "....................",
  "####################",
];

/** Town by an Exit to `field`, a Combat Area of Area Level 8. */
function areas(field: string[], spawns: Record<number, string> = {}) {
  const rows = field.map((row, y) =>
    spawns[y]
      ? [...row]
          .map((cell, x) => (spawns[y][x] === "." ? cell : spawns[y][x]))
          .join("")
      : row,
  );
  return {
    town: map(["HAE"], "field", null),
    field: map(rows, "town", 8),
  };
}

/**
 * A Hero of Level 10 with Bone Wall (Level `wall`) on the right-click slot,
 * Bone Spear on the first key and Bone Ward on the second, all at Skill
 * Level 1 bar Bone Wall, with plenty of Mana.
 */
function necromancer(wall = 1): Progress {
  const level = 10;
  return {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    energy: FRESH_PROGRESS.energy + 5 * (level - 1),
    skillPoints: 0,
    skillLevels: {
      ...FRESH_PROGRESS.skillLevels,
      boneWard: 1,
      boneSpear: 1,
      boneWall: wall,
    },
    skillBar: {
      ...emptySkillBar(),
      right: "boneWall",
      key1: "boneSpear",
      key2: "boneWard",
    },
  };
}

/** Steps with no orders until `done`, failing after `limit` steps. */
function stepUntil(w: World, done: () => boolean, limit = 1200): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; !done(); i++) {
    if (i > limit) throw new Error("Never happened");
    events.push(...step(w, []));
  }
  return events;
}

/**
 * A World with the Hero just arrived in the field, moved to `hero`, its
 * Monsters (in reading order) standing still where they were placed.
 */
function inField(
  rows: string[],
  { hero = { x: 2.5, y: 4.5 }, progress = necromancer(), spawns = {} } = {},
): World {
  const w = createWorld({
    areas: areas(rows, spawns),
    seed: 1,
    progress,
  });
  step(w, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
  stepUntil(w, () => w.areaName === "field" && !w.areaChange);
  w.hero.pos = { ...hero };
  w.hero.prevPos = { ...hero };
  return w;
}

/** Casts `slot`'s Skill at `target`, the step's events. */
function cast(
  w: World,
  slot: "right" | "key1" | "key2",
  target: Vec,
): SimEvent[] {
  return step(w, [{ type: "Cast", slot, target }]);
}

/** Puts Monster `index` at `pos`, still. */
function place(w: World, index: number, pos: Vec) {
  const monster = w.monsters[index];
  monster.pos = { ...pos };
  monster.prevPos = { ...pos };
  monster.home = { ...pos };
}

const wallTuned = { ...(skillTuning.boneWall.effect as WallEffect) };
/** The wall effect's tuned length of a Wall, in tiles. */
function wallOf(events: SimEvent[]): Vec[] {
  const raised = events.find((event) => event.type === "BoneWallRaised");
  if (raised?.type !== "BoneWallRaised") throw new Error("No Bone Wall");
  return raised.pieces;
}

describe("Bone Wall", () => {
  it("sits after Bone Spear in the Bone Branch, with Bone Spear as its Prerequisite", () => {
    expect(skillTuning.boneWall.branch).toBe("bone");
    expect(skillTuning.boneWall.prerequisite).toBe("boneSpear");
  });

  it("raises a line of its tuned length across the cast direction, at the cast point", () => {
    const w = inField(OPEN);
    const mana = w.hero.mana;

    const events = cast(w, "right", { x: 8.5, y: 4.5 });

    expect(wallOf(events)).toEqual([
      { x: 8.5, y: 3.5 },
      { x: 8.5, y: 4.5 },
      { x: 8.5, y: 5.5 },
    ]);
    expect(w.hero.mana).toBeCloseTo(mana - skillTuning.boneWall.manaCost, 0);
  });

  it("can't be cast in Town", () => {
    const w = createWorld({
      areas: areas(OPEN),
      seed: 1,
      progress: necromancer(),
    });

    const events = cast(w, "right", { x: 1.5, y: 0.5 });

    expect(events).toContainEqual({ type: "CastFailed", reason: "town" });
    expect(events.map((event) => event.type)).not.toContain("BoneWallRaised");
  });

  it("is a wall to the Hero, who can't walk through it", () => {
    const w = inField(WIDE, { hero: { x: 2.5, y: 2.5 } });
    cast(w, "right", { x: 8.5, y: 2.5 });
    stepUntil(w, () => !w.hero.cast);

    for (let i = 0; i < 240; i++) {
      step(w, [{ type: "MoveTo", target: { x: 14.5, y: 2.5 } }]);
    }

    expect(w.hero.pos.x).toBeLessThan(8);
  });

  it("is a wall to a Monster, which walks round or waits and never crosses it", () => {
    // Too sturdy for the Skeleton to break in the time.
    skillTuning.boneWall.effect = {
      ...wallTuned,
      pieceLife: 1_000_000,
      durationMs: 600_000,
    } as WallEffect;
    const w = inField(CORRIDOR, {
      hero: { x: 2.5, y: 1.5 },
      spawns: { 1: "........S..........." },
      progress: necromancer(),
    });
    place(w, 0, { x: 8.5, y: 1.5 });
    cast(w, "right", { x: 6.5, y: 1.5 });

    for (let i = 0; i < 400; i++) step(w, []);

    expect(w.monsters[0].pos.x).toBeGreaterThan(6.9);
  });

  it("stops a Monster's Arrow, which then never reaches the Hero", () => {
    const w = inField(OPEN, {
      hero: { x: 5.5, y: 4.5 },
      spawns: { 4: "..........R........." },
    });
    place(w, 0, { x: 11.5, y: 4.5 });
    cast(w, "right", { x: 8.5, y: 4.5 });

    const events: SimEvent[] = [];
    for (let i = 0; i < 240; i++) events.push(...step(w, []));

    expect(events.map((event) => event.type)).toContain("BoneWallHit");
    expect(events.map((event) => event.type)).not.toContain("HeroHit");
    expect(w.projectiles).toHaveLength(0);
  });

  it("lets Bone Spear fly through to hit a Monster behind it", () => {
    const w = inField(OPEN, { spawns: { 4: "..........S........." } });
    place(w, 0, { x: 11.5, y: 4.5 });
    cast(w, "right", { x: 8.5, y: 4.5 });
    stepUntil(w, () => !w.hero.cast);

    const events = cast(w, "key1", { x: 11.5, y: 4.5 });
    events.push(...stepUntil(w, () => w.projectiles.length === 0));

    expect(events).toContainEqual(
      expect.objectContaining({ type: "HitLanded", attacker: "skill" }),
    );
  });

  it("is attacked by a Monster that can't reach the Hero, until it breaks", () => {
    skillTuning.boneWall.effect = {
      ...wallTuned,
      durationMs: 600_000,
    } as WallEffect;
    const w = inField(CORRIDOR, {
      hero: { x: 2.5, y: 1.5 },
      spawns: { 1: "..................S." },
    });
    place(w, 0, { x: 8.5, y: 1.5 });
    cast(w, "right", { x: 6.5, y: 1.5 });

    const events = stepUntil(w, () => w.boneWalls.length === 0, 60 * 120);

    const hits = events.filter((event) => event.type === "BoneWallHit");
    expect(hits.length).toBeGreaterThan(1);
    expect(events).toContainEqual({
      type: "BoneWallCrumbled",
      pos: { x: 6.5, y: 1.5 },
      broken: true,
    });
    expect(events.map((event) => event.type)).not.toContain("HeroHit");
  });

  it("crumbles after its tuned time, and can be walked through then", () => {
    const w = inField(OPEN);
    const raised = cast(w, "right", { x: 8.5, y: 4.5 });
    const pieces = wallOf(raised);

    const events = stepUntil(w, () => w.boneWalls.length === 0, 60 * 20);

    expect(events).toContainEqual({
      type: "BoneWallCrumbled",
      pos: pieces[1],
      broken: false,
    });
    expect(w.tick).toBeGreaterThan((wallTuned.durationMs / 1000) * 60 - 30);
    for (let i = 0; i < 400; i++) {
      step(w, [{ type: "MoveTo", target: { x: 14.5, y: 4.5 } }]);
    }
    expect(w.hero.pos.x).toBeGreaterThan(12);
  });

  it("grows Bone Spear's damage by its Synergy for each Skill Level of Bone Wall", () => {
    skillTuning.boneSpear.effect = {
      ...(skillTuning.boneSpear.effect as object),
      damage: [100, 100],
      damagePerSkillLevel: 0,
    } as typeof skillTuning.boneSpear.effect;
    const percent = skillTuning.boneSpear.synergies.find(
      (synergy) => synergy.skill === "boneWall",
    )?.percentPerSkillLevel as number;
    const damageAt = (wall: number) => {
      const w = inField(OPEN, {
        progress: necromancer(wall),
        spawns: { 4: "..........S........." },
      });
      place(w, 0, { x: 11.5, y: 4.5 });
      const events = cast(w, "key1", { x: 11.5, y: 4.5 });
      events.push(...stepUntil(w, () => w.projectiles.length === 0));
      const landed = events.find((event) => event.type === "HitLanded");
      if (landed?.type !== "HitLanded") throw new Error("No hit");
      return landed.damage;
    };

    expect(damageAt(0)).toBe(100);
    expect(damageAt(4)).toBe(Math.round(100 * (1 + (percent * 4) / 100)));
  });

  it("grows Bone Ward's soak by its Synergy for each Skill Level of Bone Wall", () => {
    skillTuning.boneWard.effect = {
      type: "ward",
      amount: 100,
      amountPerSkillLevel: 0,
    };
    const percent = skillTuning.boneWard.synergies.find(
      (synergy) => synergy.skill === "boneWall",
    )?.percentPerSkillLevel as number;
    const soakAt = (wall: number) => {
      const w = inField(OPEN, { progress: necromancer(wall) });
      cast(w, "key2", { x: 8.5, y: 4.5 });
      return w.hero.boneWard?.full;
    };

    expect(soakAt(0)).toBe(100);
    expect(soakAt(5)).toBe(Math.round(100 * (1 + (percent * 5) / 100)));
  });
});
