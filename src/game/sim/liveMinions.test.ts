import { describe, expect, it } from "vitest";
import { minionFrameRows } from "../render/minionFrame";
import { skillTuning } from "../tuning/skills";
import { emptyBelt } from "./belt";
import { inventoryOf } from "./inventory";
import { minionDamageRange } from "./minions";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import {
  type Corpse,
  createWorld,
  FRESH_PROGRESS,
  type Minion,
  minionLevelOf,
  type Progress,
  raiseCount,
  step,
  type World,
} from "./world";

const layer = (name: string, data: number[], w: number, h: number) => ({
  type: "tilelayer",
  name,
  width: w,
  height: h,
  data,
});
const map = (width: number, height: number, objects: object[]) => ({
  orientation: "orthogonal",
  width,
  height,
  tilewidth: 32,
  tileheight: 32,
  tilesets: [{ firstgid: 1, name: "test", tiles: [] }],
  layers: [
    layer("floor", new Array(width * height).fill(1), width, height),
    layer("walls & props", new Array(width * height).fill(0), width, height),
    { type: "objectgroup", name: "objects", objects },
  ],
});
const entry = (name: string, x: number, y: number) => ({
  name,
  type: "entry",
  x: (x + 0.5) * 32,
  y: (y + 0.5) * 32,
});
const AREAS = {
  town: map(3, 1, [
    entry("start", 0, 0),
    entry("arrive", 1, 0),
    {
      name: "",
      type: "exit",
      x: 2 * 32,
      y: 0,
      width: 32,
      height: 32,
      properties: [
        { name: "area", type: "string", value: "field" },
        { name: "entry", type: "string", value: "arrive" },
      ],
    },
  ]),
  field: combatArea(
    map(14, 10, [entry("start", 0, 0), entry("arrive", 1, 0)]),
    3,
  ),
};

/** A World with the Hero in the field and Skill Points to spend. */
function inField(
  skillLevels: Partial<Progress["skillLevels"]>,
  wand = false,
): World {
  const w = createWorld({
    areas: AREAS,
    seed: 1,
    progress: {
      ...FRESH_PROGRESS,
      level: 30,
      skillPoints: 10,
      energy: 400,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, ...skillLevels },
      skillBar: { ...emptySkillBar(), right: "raiseSkeleton" },
    },
    belongings: {
      inventory: wand
        ? [
            {
              type: "boneWand" as const,
              rarity: "magic" as const,
              affixes: [
                { kind: "skillRaiseSkeleton" as const, grade: 2, value: 3 },
              ],
              cell: { column: 0, row: 0 },
            },
          ]
        : [],
      equipment: {},
      belt: emptyBelt(),
    },
  });
  step(w, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
  for (let i = 0; (w.areaName !== "field" || w.areaChange) && i < 600; i++) {
    step(w, []);
  }
  w.hero.mana = 900;
  return w;
}

/** Raises one more Skeleton from a fresh Corpse and returns it. */
function raiseSkeleton(w: World): Minion {
  const corpse: Corpse = {
    id: w.nextMonsterId++,
    type: "skeleton",
    monsterLevel: 3,
    pos: { x: 5, y: 4 },
  };
  w.corpses.push(corpse);
  step(w, [{ type: "Cast", slot: "right", target: corpse.pos }]);
  for (let i = 0; w.hero.cast && i < 600; i++) step(w, []);
  const minion = w.minions.at(-1);
  if (!minion) throw new Error("No Minion");
  return minion;
}

function spend(w: World, skill: "raiseSkeleton" | "golem" | "graveCommand") {
  step(w, [{ type: "SpendSkillPoint", skill }]);
}

describe("live Minion stats", () => {
  it("a Skill Point in Raise Skeleton changes a Raised Skeleton already out", () => {
    const w = inField({ raiseSkeleton: 1 });
    const skeleton = raiseSkeleton(w);
    const before = skeleton.maxLife;
    const mostBefore = minionDamageRange(minionLevelOf(w, skeleton))[1];
    spend(w, "raiseSkeleton");
    expect(skeleton.maxLife).toBeGreaterThan(before);
    expect(minionDamageRange(minionLevelOf(w, skeleton))[1]).toBeGreaterThan(
      mostBefore,
    );
  });

  it("a Skill Point in a Synergy giver changes the Minion it boosts", () => {
    const w = inField({ raiseSkeleton: 1, golem: 1 });
    const skeleton = raiseSkeleton(w);
    const before = skeleton.maxLife;
    spend(w, "golem");
    expect(skeleton.maxLife).toBeGreaterThan(before);
  });

  it("a Skill Point in Grave Command changes the Minions it boosts", () => {
    const w = inField({ raiseSkeleton: 1, golem: 1, raiseArcher: 1 });
    const skeleton = raiseSkeleton(w);
    const before = skeleton.maxLife;
    spend(w, "graveCommand");
    expect(skeleton.maxLife).toBeGreaterThan(before);
  });

  it("current Life rises with maximum Life, and is capped when it falls", () => {
    const w = inField({ raiseSkeleton: 3 });
    const skeleton = raiseSkeleton(w);
    skeleton.life = 10;
    const before = skeleton.maxLife;
    spend(w, "raiseSkeleton");
    const rise = skeleton.maxLife - before;
    expect(rise).toBeGreaterThan(0);
    expect(skeleton.life).toBe(10 + rise);
    skeleton.life = skeleton.maxLife;
    w.hero.progress.skillLevels.raiseSkeleton = 1;
    step(w, []);
    expect(skeleton.maxLife).toBeLessThan(before);
    expect(skeleton.life).toBe(skeleton.maxLife);
  });

  it("equipping or taking off a Wand with +Skill Levels changes the Minions at once", () => {
    const w = inField({ raiseSkeleton: 1 }, true);
    const skeleton = raiseSkeleton(w);
    const plain = skeleton.maxLife;
    const [{ item }] = [...inventoryOf(w)];
    step(w, [{ type: "EquipItem", item: item.id }]);
    expect(skeleton.maxLife).toBeGreaterThan(plain);
    step(w, [{ type: "LiftItem", from: "weapon" }]);
    expect(skeleton.maxLife).toBe(plain);
    expect(skeleton.life).toBeLessThanOrEqual(plain);
  });

  it("follows the current Skill Level for the count limit, keeping the extra until one more is raised", () => {
    const { effect } = skillTuning.raiseSkeleton;
    if (effect.type !== "raise") throw new Error("Not a raise");
    const w = inField({ raiseSkeleton: 10 });
    const limit = raiseCount(effect, 10);
    for (let i = 0; i < limit; i++) raiseSkeleton(w);
    expect(w.minions.length).toBe(limit);
    w.hero.progress.skillLevels.raiseSkeleton = 1;
    step(w, []);
    expect(w.minions.length).toBe(limit);
    raiseSkeleton(w);
    expect(w.minions.length).toBe(raiseCount(effect, 1));
  });

  it("the Minion Frame's cap and Life bars follow a Skill Point", () => {
    const w = inField({ raiseSkeleton: 3 });
    const skeleton = raiseSkeleton(w);
    skeleton.life = skeleton.maxLife / 2;
    const [before] = minionFrameRows(w);
    spend(w, "raiseSkeleton");
    spend(w, "raiseSkeleton");
    const [after] = minionFrameRows(w);
    expect(after.cap).toBeGreaterThan(before.cap ?? 0);
    expect(after.bars[0].fraction).toBeGreaterThan(before.bars[0].fraction);
  });
});
