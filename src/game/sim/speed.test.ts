import { describe, expect, it } from "vitest";
import { affixTuning } from "../tuning/items";
import { emptyBelt } from "./belt";
import type { Belongings } from "./inventory";
import { emptySkillBar } from "./skillBar";
import {
  createWorld,
  FRESH_PROGRESS,
  heroAttackSpeed,
  heroWalkSpeed,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area of open floor drawn row by row: `.` floor, `H` the
 * Hero's `start` and `S` one Skeleton, each in the middle of its tile.
 */
function map(rows: string[]) {
  const width = rows[0].length;
  const height = rows.length;
  const objects: object[] = [];
  [...rows.join("")].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") objects.push({ name: "start", type: "entry", x, y });
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
  });
  return {
    orientation: "orthogonal",
    width,
    height,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width,
        height,
        data: new Array(width * height).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

const gloves = (value?: number): Belongings["equipment"] => ({
  gloves: {
    type: "leatherGloves",
    rarity: value === undefined ? "normal" : "magic",
    affixes:
      value === undefined ? [] : [{ kind: "attackSpeed", grade: 0, value }],
  },
});

const boots = (value?: number): Belongings["equipment"] => ({
  boots: {
    type: "leatherBoots",
    rarity: value === undefined ? "normal" : "magic",
    affixes:
      value === undefined ? [] : [{ kind: "walkSpeed", grade: 0, value }],
  },
});

function wearing(rows: string[], equipment: Belongings["equipment"]): World {
  return createWorld({
    areas: { town: map(rows) },
    seed: 1,
    belongings: { inventory: [], equipment, belt: emptyBelt() },
  });
}

/** How many steps a swing at the empty air takes. */
function swingSteps(equipment: Belongings["equipment"]): number {
  const w = wearing(["H."], equipment);
  step(w, [{ type: "SwingAt", target: { x: 1.5, y: 0.5 } }]);
  let steps = 1;
  while (w.hero.swing) {
    step(w, []);
    steps += 1;
  }
  return steps;
}

/** The step of a swing at a Skeleton on which its hit lands. */
function hitStep(equipment: Belongings["equipment"]): number {
  const w = wearing(["HS"], equipment);
  const monster = w.monsters[0].id;
  let events: SimEvent[] = step(w, [{ type: "Attack", monster }]);
  let steps = 1;
  while (
    !events.some((e) => e.type === "HitLanded" || e.type === "Missed") &&
    steps < 200
  ) {
    events = step(w, []);
    steps += 1;
  }
  return steps;
}

/** How far the Hero gets walking east for 30 steps. */
function walked(equipment: Belongings["equipment"]): number {
  const w = wearing([`H${".".repeat(40)}`], equipment);
  const from = w.hero.pos.x;
  for (let i = 0; i < 30; i++) {
    step(w, [{ type: "MoveTo", target: { x: 39.5, y: 0.5 } }]);
  }
  return w.hero.pos.x - from;
}

describe("attack speed", () => {
  it("is a Suffix of named grades that rolls only on Gloves", () => {
    expect(affixTuning.attackSpeed.side).toBe("suffix");
    expect(affixTuning.attackSpeed.rollsOn).toEqual(["gloves"]);
    expect(
      affixTuning.attackSpeed.grades.map((g) => g.fromMonsterLevel),
    ).toEqual([1, 5, 9]);
    expect(
      new Set(affixTuning.attackSpeed.grades.map((g) => g.name)).size,
    ).toBe(3);
  });

  it("is 0 with no Gloves, and what the Gloves' Affixes add", () => {
    expect(heroAttackSpeed(wearing(["H."], {}))).toBe(0);
    expect(heroAttackSpeed(wearing(["H."], gloves()))).toBe(0);
    expect(heroAttackSpeed(wearing(["H."], gloves(20)))).toBe(20);
  });

  it("shortens the swing, restoring it when the Gloves come off", () => {
    // The order's own step starts the swing, so a 21-step swing shows as 22.
    expect(swingSteps({})).toBe(22);
    expect(swingSteps(gloves())).toBe(22);
    // 350 ms / 1.5 = 233 ms, 14 steps.
    expect(swingSteps(gloves(50))).toBe(15);
    const w = wearing(["H."], gloves(50));
    w.hero.equipment.gloves = null;
    expect(heroAttackSpeed(w)).toBe(0);
  });

  it("lands the hit at the same fraction through the swing", () => {
    // 140 ms is 8 steps of 21; 93 ms is 6 steps of 14.
    expect(hitStep({})).toBe(9);
    expect(hitStep(gloves(50))).toBe(7);
  });

  it("does not speed up casting", () => {
    const castSteps = (equipment: Belongings["equipment"]) => {
      const w = createWorld({
        areas: { town: map(["H...."]) },
        seed: 1,
        progress: {
          ...FRESH_PROGRESS,
          level: 2,
          experience: 500,
          skillLevels: { ...FRESH_PROGRESS.skillLevels, golem: 1 },
          skillBar: { ...emptySkillBar(), right: "golem" },
        },
        belongings: { inventory: [], equipment, belt: emptyBelt() },
      });
      let events = step(w, [
        { type: "Cast", slot: "right", target: { x: 3.5, y: 0.5 } },
      ]);
      let steps = 1;
      while (!events.some((e) => e.type === "SkillCast") && steps < 200) {
        events = step(w, []);
        steps += 1;
      }
      return steps;
    };
    expect(castSteps(gloves(50))).toBe(castSteps({}));
  });
});

describe("walk speed", () => {
  it("is a Suffix of named grades that rolls only on Boots", () => {
    expect(affixTuning.walkSpeed.side).toBe("suffix");
    expect(affixTuning.walkSpeed.rollsOn).toEqual(["boots"]);
    expect(affixTuning.walkSpeed.grades.map((g) => g.fromMonsterLevel)).toEqual(
      [1, 5, 9],
    );
  });

  it("is 0 with no Boots, and what the Boots' Affixes add", () => {
    expect(heroWalkSpeed(wearing(["H."], {}))).toBe(0);
    expect(heroWalkSpeed(wearing(["H."], boots(20)))).toBe(20);
  });

  it("covers more ground per step, and the base again without the Boots", () => {
    const base = walked({});
    expect(walked(boots())).toBeCloseTo(base);
    expect(walked(boots(50))).toBeCloseTo(base * 1.5);
  });

  it("counts walking in a direction too", () => {
    const along = (equipment: Belongings["equipment"]) => {
      const w = wearing([`H${".".repeat(40)}`], equipment);
      for (let i = 0; i < 30; i++) {
        step(w, [{ type: "Walk", direction: { x: 1, y: 0 } }]);
      }
      return w.hero.pos.x - 0.5;
    };
    expect(along(boots(50))).toBeCloseTo(along({}) * 1.5);
  });

  it("replays from a seed", () => {
    expect(walked(boots(30))).toBe(walked(boots(30)));
  });
});
