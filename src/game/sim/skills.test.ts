import { afterEach, describe, expect, it } from "vitest";
import { skillTuning } from "../tuning/skills";
import { emptySkillBar, placeLearnedSkill } from "./skillBar";
import {
  createWorld,
  FRESH_PROGRESS,
  type Progress,
  progressOf,
  type SimEvent,
  type Skill,
  step,
  type World,
} from "./world";

/**
 * A Town of open floor, the Hero's `start` on the first tile and a pack of
 * `pack` Skeletons on the third.
 */
function town(pack: number) {
  return {
    orientation: "orthogonal",
    width: 5,
    height: 1,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 5,
        height: 1,
        data: [1, 1, 1, 1, 1],
      },
      {
        type: "objectgroup",
        name: "objects",
        objects: [
          { name: "start", type: "entry", point: true, x: 16, y: 16 },
          {
            name: "",
            type: "monsterSpawn",
            point: true,
            x: 80,
            y: 16,
            properties: [
              { name: "monster", type: "string", value: "skeleton" },
              { name: "count", type: "int", value: pack },
            ],
          },
        ],
      },
    ],
  };
}

function world(progress?: Progress, pack = 1): World {
  return createWorld({ areas: { town: town(pack) }, seed: 1, progress });
}

/** Attacks the nearest Monster until `kills` have died. */
function kill(w: World, kills: number) {
  let died = 0;
  for (let i = 0; died < kills; i++) {
    if (i > 60 * 60) throw new Error(`Only ${died} of ${kills} kills`);
    const [nearest] = [...w.monsters].sort(
      (a, b) => gap(w, a.pos) - gap(w, b.pos),
    );
    const events = step(w, [{ type: "Attack", monster: nearest.id }]);
    died += events.filter((event) => event.type === "MonsterDied").length;
  }
}

function gap(w: World, pos: { x: number; y: number }): number {
  return Math.hypot(pos.x - w.hero.pos.x, pos.y - w.hero.pos.y);
}

/** A Level `level` Hero with `skillPoints` unspent and no Skill learned. */
function withSkillPoints(level: number, skillPoints: number): Progress {
  return {
    ...FRESH_PROGRESS,
    level,
    experience: [0, 500, 1_500, 3_750][level - 1],
    attributePoints: 5 * (level - 1),
    skillPoints,
    skillLevels: { golem: level - 1 - skillPoints },
  };
}

/** Spends `times` Skill Points on `skill`, one step each, returning the events. */
function spend(w: World, skill: Skill, times = 1): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < times; i++) {
    events.push(...step(w, [{ type: "SpendSkillPoint", skill }]));
  }
  return events;
}

const golemRequiredLevel = skillTuning.golem.requiredLevel;
afterEach(() => {
  skillTuning.golem.requiredLevel = golemRequiredLevel;
});

describe("a New Hero", () => {
  it("has no Skills learned and no Skill Points", () => {
    expect(progressOf(world())).toMatchObject({
      skillPoints: 0,
      skillLevels: { golem: 0 },
    });
  });
});

describe("Skill Points", () => {
  it("come one with each new Level, kept until spent", () => {
    const w = world(undefined, 5);

    kill(w, 5);

    expect(progressOf(w)).toMatchObject({ level: 2, skillPoints: 1 });
  });
});

describe("SpendSkillPoint", () => {
  it("raises the Skill's Skill Level by one for one point and reports it", () => {
    const w = world(withSkillPoints(3, 2));

    expect(spend(w, "golem")).toEqual([
      { type: "SkillLevelRaised", skill: "golem", skillLevel: 1 },
    ]);
    expect(spend(w, "golem")).toEqual([
      { type: "SkillLevelRaised", skill: "golem", skillLevel: 2 },
    ]);
    expect(progressOf(w)).toMatchObject({
      skillPoints: 0,
      skillLevels: { golem: 2 },
    });
  });

  it("is ignored with no unspent Skill Point", () => {
    const w = world(withSkillPoints(2, 1));
    spend(w, "golem");

    expect(spend(w, "golem")).toEqual([]);
    expect(progressOf(w)).toMatchObject({
      skillPoints: 0,
      skillLevels: { golem: 1 },
    });
  });

  it("is ignored below the Skill's required Level", () => {
    skillTuning.golem.requiredLevel = 3;
    const w = world(withSkillPoints(2, 1));

    expect(spend(w, "golem")).toEqual([]);
    expect(progressOf(w)).toMatchObject({
      skillPoints: 1,
      skillLevels: { golem: 0 },
    });
  });

  it("doesn't interrupt a swing", () => {
    const w = world(withSkillPoints(2, 1));
    step(w, [{ type: "SwingAt", target: { x: 2.5, y: 0.5 } }]);
    const swing = w.hero.swing;

    spend(w, "golem");

    expect(w.hero.swing).toBe(swing);
    expect(progressOf(w).skillLevels.golem).toBe(1);
  });

  it("keeps a saved progress apart from the World's", () => {
    const saved = withSkillPoints(2, 1);
    const w = world(saved);

    spend(w, "golem");
    const kept = progressOf(w);
    spend(world(saved), "golem");

    expect(saved.skillLevels.golem).toBe(0);
    expect(kept.skillLevels.golem).toBe(1);
    expect(progressOf(w).skillLevels).not.toBe(kept.skillLevels);
    expect(saved.skillBar.right).toBeNull();
    expect(progressOf(w).skillBar).not.toBe(kept.skillBar);
  });
});

describe("learning a Skill", () => {
  it("puts it into the right-click slot of an empty Skill Bar", () => {
    const w = world(withSkillPoints(2, 1));

    spend(w, "golem");

    expect(progressOf(w).skillBar).toEqual({
      right: "golem",
      key1: null,
      key2: null,
      key3: null,
      key4: null,
    });
  });

  it("leaves the Skill Bar as it is when raising a Skill already learned", () => {
    const w = world(withSkillPoints(3, 1));

    spend(w, "golem");

    expect(progressOf(w).skillBar).toEqual(emptySkillBar());
  });
});

describe("placeLearnedSkill", () => {
  // A second Skill, which the tuning doesn't have yet.
  const other = "boneWall" as Skill;

  it("takes the first empty keyed slot when the right-click slot is taken", () => {
    const bar = { ...emptySkillBar(), right: other, key1: other };

    expect(placeLearnedSkill(bar, "golem")).toEqual({
      ...bar,
      key2: "golem",
    });
  });

  it("leaves a full Skill Bar as it is", () => {
    const full = {
      right: other,
      key1: other,
      key2: other,
      key3: other,
      key4: other,
    };

    expect(placeLearnedSkill(full, "golem")).toEqual(full);
  });
});
