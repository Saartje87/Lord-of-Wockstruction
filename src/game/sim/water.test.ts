import { describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
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

/** The tileset of the test maps: gid 1 is floor, gid 2 is Water. */
const tileset = {
  firstgid: 1,
  name: "test",
  tiles: [
    {
      id: 0,
      properties: [
        { name: "piece", type: "string", value: "floor" },
        { name: "kind", type: "string", value: "floor" },
        { name: "blocks", type: "bool", value: false },
      ],
    },
    {
      id: 1,
      properties: [
        { name: "piece", type: "string", value: "water" },
        { name: "kind", type: "string", value: "water" },
        { name: "blocks", type: "bool", value: false },
      ],
    },
  ],
};

/**
 * An orthogonal Area drawn row by row: `.` floor, `~` Water, `H` the Hero's
 * `start`, `S` a Skeleton, `E` an Exit to Town, and on Water `n` an Entry
 * `w` a Waypoint and `e` an Exit, and on floor `W` a Waypoint, `A` a Skeleton Archer and `P` a pack of five
 * Skeletons, each in the middle of its tile.
 */
function map(rows: string[]) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = [...rows.join("")];
  const objects: object[] = [];
  const spawn = (monster: string, x: number, y: number, count = 1) => ({
    name: "",
    type: "monsterSpawn",
    point: true,
    x,
    y,
    properties: [
      { name: "monster", type: "string", value: monster },
      { name: "count", type: "int", value: count },
    ],
  });
  cells.forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") objects.push({ name: "start", type: "entry", x, y });
    if (cell === "n") objects.push({ name: "arrive", type: "entry", x, y });
    if (cell === "w" || cell === "W") objects.push({ name: "", type: "waypoint", x, y });
    if (cell === "e" || cell === "E") {
      objects.push({
        name: "",
        type: "exit",
        x: x - 16,
        y: y - 16,
        width: 32,
        height: 32,
        properties: [
          { name: "area", type: "string", value: "town" },
          { name: "entry", type: "string", value: "start" },
        ],
      });
    }
    if (cell === "S") objects.push(spawn("skeleton", x, y));
    if (cell === "A") objects.push(spawn("skeleton_archer", x, y));
    if (cell === "P") objects.push(spawn("skeleton", x, y, 5));
  });
  return {
    orientation: "orthogonal",
    width,
    height,
    tilewidth: 32,
    tileheight: 32,
    tilesets: [tileset],
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width,
        height,
        data: cells.map((cell) => ("~new".includes(cell) ? 2 : 1)),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

/** A World started in `rows`, a Combat Area, beside an empty Town. */
function pond(rows: string[], progress: Progress = FRESH_PROGRESS): World {
  return createWorld({
    areas: {
      town: map(["H"]),
      field: combatArea(map(rows), 1),
    },
    seed: 1,
    progress,
    start: { area: "field", entry: "start" },
  });
}

/** Whether `pos` is on a Water tile of the World's Area. */
function inWater(w: World, pos: Vec): boolean {
  const area = w.areas[w.areaName];
  return area.water[Math.floor(pos.y) * area.width + Math.floor(pos.x)];
}

const distance = (a: Vec, b: Vec) => Math.hypot(b.x - a.x, b.y - a.y);

/** A Hero of Level 6 with a Skill Point in Bone Spear, on the right click. */
function spearman(): Progress {
  const level = 6;
  return {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    energy: FRESH_PROGRESS.energy + 5 * (level - 1),
    skillPoints: 4,
    skillLevels: { ...FRESH_PROGRESS.skillLevels, boneSpear: 1 },
    skillBar: { ...emptySkillBar(), right: "boneSpear" },
  };
}

const POND = [
  "H.....", //
  ".~~~~.",
  ".~~~~.",
  ".~~~~.",
  "......",
];

describe("walking round Water", () => {
  it("takes the Hero round a pond to a spot beyond it, never through", () => {
    const w = pond(POND);
    step(w, [{ type: "MoveTo", target: { x: 5.5, y: 4.5 } }]);
    for (let i = 0; i < 60 * 8; i++) {
      step(w, []);
      expect(inWater(w, w.hero.pos)).toBe(false);
    }
    expect(distance(w.hero.pos, { x: 5.5, y: 4.5 })).toBeLessThan(0.2);
  });

  it("walks the Hero as close as they can get when Water is clicked", () => {
    const w = pond(POND);
    step(w, [{ type: "MoveTo", target: { x: 2.5, y: 2.5 } }]);
    for (let i = 0; i < 60 * 8; i++) {
      step(w, []);
      expect(inWater(w, w.hero.pos)).toBe(false);
    }
    // On the bank beside the pond, not back at the start.
    expect(distance(w.hero.pos, { x: 2.5, y: 2.5 })).toBeLessThan(2);
  });

  it("takes a chasing Skeleton round a pond to the Hero", () => {
    const w = pond(["H.....", ".~~~~.", ".~~~~.", ".~~~~.", "....S."]);
    const [skeleton] = w.monsters;
    let reached = false;
    for (let i = 0; i < 60 * 15 && !reached; i++) {
      step(w, []);
      expect(inWater(w, skeleton.pos)).toBe(false);
      reached = distance(skeleton.pos, w.hero.pos) < 1.5;
    }
    expect(reached).toBe(true);
  });

  it("takes a Raised Skeleton round a pond after the Hero", () => {
    const raiser: Progress = {
      ...FRESH_PROGRESS,
      level: 2,
      experience: heroTuning.experienceTable[1],
      energy: FRESH_PROGRESS.energy + 5,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, raiseSkeleton: 1 },
      skillBar: { ...emptySkillBar(), right: "raiseSkeleton" },
    };
    const w = pond(POND, raiser);
    w.corpses.push({
      id: w.nextMonsterId++,
      type: "skeleton",
      monsterLevel: 1,
      pos: { x: 0.5, y: 1.5 },
    });
    step(w, [{ type: "Cast", slot: "right", target: { x: 0.5, y: 1.5 } }]);
    for (let i = 0; i < 60 && w.minions.length === 0; i++) step(w, []);
    expect(w.minions).toHaveLength(1);

    step(w, [{ type: "MoveTo", target: { x: 5.5, y: 4.5 } }]);
    for (let i = 0; i < 60 * 10; i++) {
      step(w, []);
      expect(inWater(w, w.hero.pos)).toBe(false);
      for (const minion of w.minions) expect(inWater(w, minion.pos)).toBe(false);
    }
    expect(distance(w.minions[0].pos, w.hero.pos)).toBeLessThan(4);
  });
});

describe("seeing over Water", () => {
  it("lets a Monster notice the Hero across a pond", () => {
    const w = pond(["H~~~S...."]);
    const [skeleton] = w.monsters;

    step(w, []);

    expect(["chase", "windup", "recover"]).toContain(skeleton.state);
  });

  it("lets a Skeleton Archer wind up on the Hero across a pond", () => {
    const w = pond(["H~~~~A"]);
    const [archer] = w.monsters;
    for (let i = 0; archer.state !== "windup" && i < 60 * 10; i++) {
      step(w, []);
    }
    expect(archer.state).toBe("windup");
  });

  it("lets the Archer's Arrow fly over the pond to the Hero", () => {
    const w = pond(["H~~~~A"]);
    const events: SimEvent[] = [];
    const landed = () =>
      events.some(
        (e) =>
          e.type === "HeroHit" || (e.type === "Missed" && e.target === "hero"),
      );
    for (let i = 0; i < 60 * 10 && !landed(); i++) events.push(...step(w, []));
    expect(landed()).toBe(true);
  });
});

describe("Bone Spear over Water", () => {
  it("flies over a pond to hit a Skeleton beyond it", () => {
    const w = pond(["H.~~~~S"], spearman());
    const [skeleton] = w.monsters;
    skeleton.life = 100000;

    const events = step(w, [
      { type: "Cast", slot: "right", target: { x: 6.5, y: 0.5 } },
    ]);
    for (let i = 0; i < 120; i++) events.push(...step(w, []));

    expect(
      events.some((e) => e.type === "HitLanded" && e.target === skeleton.id),
    ).toBe(true);
  });
});

describe("placing creatures beside Water", () => {
  it("never stands a pack's Skeletons in the pond beside them", () => {
    const w = pond(["H.....", "~P~~~~", "~~~~~~", "~~~~~~"]);
    expect(w.monsters).toHaveLength(5);
    for (const monster of w.monsters) expect(inWater(w, monster.pos)).toBe(false);
  });
});

describe("validating an Area with Water", () => {
  const make = (rows: string[]) => () => pond(rows);

  it("accepts a pond that leaves every object reachable", () => {
    expect(make(["H.~~.E", ".....W"])).not.toThrow();
  });

  it("rejects an Entry on Water", () => {
    expect(make(["H.n"])).toThrow(/Entry/);
  });

  it("rejects an Exit on Water", () => {
    expect(make(["H.e"])).toThrow(/Exit/);
  });

  it("rejects a Waypoint on Water", () => {
    expect(make(["H.w"])).toThrow(/Waypoint/);
  });

  it("rejects an Exit that Water cuts off from the start", () => {
    expect(make(["H.~.E"])).toThrow(/Exit/);
  });

  it("rejects a Waypoint that Water cuts off from the start", () => {
    expect(make(["H~.", "~~.", "..W"])).toThrow(/Waypoint/);
  });
});
