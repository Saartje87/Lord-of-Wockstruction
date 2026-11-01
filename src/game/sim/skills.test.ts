import { describe, expect, it } from "vitest";
import {
  BRANCH_GRID,
  BRANCHES,
  branchSkills,
  type CastSkill,
  type GridPlace,
  isPassive,
  skillTuning,
} from "../tuning/skills";
import {
  emptySkillBar,
  placeLearnedSkill,
  putSkillOnBar,
  SKILL_BAR_SLOTS,
} from "./skillBar";
import {
  canRaiseSkill,
  createWorld,
  FRESH_PROGRESS,
  type Progress,
  progressOf,
  type SimEvent,
  SKILLS,
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
    skillLevels: {
      ...FRESH_PROGRESS.skillLevels,
      raiseSkeleton: level - 1 - skillPoints,
    },
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

describe("a New Hero", () => {
  it("has no Skills learned and no Skill Points", () => {
    expect(progressOf(world())).toMatchObject({
      skillPoints: 0,
      skillLevels: { raiseSkeleton: 0 },
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

    expect(spend(w, "raiseSkeleton")).toEqual([
      { type: "SkillLevelRaised", skill: "raiseSkeleton", skillLevel: 1 },
    ]);
    expect(spend(w, "raiseSkeleton")).toEqual([
      { type: "SkillLevelRaised", skill: "raiseSkeleton", skillLevel: 2 },
    ]);
    expect(progressOf(w)).toMatchObject({
      skillPoints: 0,
      skillLevels: { raiseSkeleton: 2 },
    });
  });

  it("is ignored with no unspent Skill Point", () => {
    const w = world(withSkillPoints(2, 1));
    spend(w, "raiseSkeleton");

    expect(spend(w, "raiseSkeleton")).toEqual([]);
    expect(progressOf(w)).toMatchObject({
      skillPoints: 0,
      skillLevels: { raiseSkeleton: 1 },
    });
  });

  it("is ignored below the Skill's required Level", () => {
    skillTuning.raiseSkeleton.requiredLevel = 3;
    const w = world(withSkillPoints(2, 1));

    expect(spend(w, "raiseSkeleton")).toEqual([]);
    expect(progressOf(w)).toMatchObject({
      skillPoints: 1,
      skillLevels: { raiseSkeleton: 0 },
    });
  });

  it("doesn't interrupt a swing", () => {
    const w = world(withSkillPoints(2, 1));
    step(w, [{ type: "SwingAt", target: { x: 2.5, y: 0.5 } }]);
    const swing = w.hero.swing;

    spend(w, "raiseSkeleton");

    expect(w.hero.swing).toBe(swing);
    expect(progressOf(w).skillLevels.raiseSkeleton).toBe(1);
  });

  it("keeps a saved progress apart from the World's", () => {
    const saved = withSkillPoints(2, 1);
    const w = world(saved);

    spend(w, "raiseSkeleton");
    const kept = progressOf(w);
    spend(world(saved), "raiseSkeleton");

    expect(saved.skillLevels.raiseSkeleton).toBe(0);
    expect(kept.skillLevels.raiseSkeleton).toBe(1);
    expect(progressOf(w).skillLevels).not.toBe(kept.skillLevels);
    expect(saved.skillBar.right).toBeNull();
    expect(progressOf(w).skillBar).not.toBe(kept.skillBar);
  });
});

describe("learning a Skill", () => {
  it("puts it into the right-click slot of an empty Skill Bar", () => {
    const w = world(withSkillPoints(2, 1));

    spend(w, "raiseSkeleton");

    expect(progressOf(w).skillBar).toEqual({
      right: "raiseSkeleton",
      key1: null,
      key2: null,
      key3: null,
      key4: null,
    });
  });

  it("leaves the Skill Bar as it is when raising a Skill already learned", () => {
    const w = world(withSkillPoints(3, 1));

    spend(w, "raiseSkeleton");

    expect(progressOf(w).skillBar).toEqual(emptySkillBar());
  });
});

describe("placeLearnedSkill", () => {
  // A second Skill, which the tuning doesn't have yet.
  const other = "boneWall" as CastSkill;

  it("takes the first empty keyed slot when the right-click slot is taken", () => {
    const bar = { ...emptySkillBar(), right: other, key1: other };

    expect(placeLearnedSkill(bar, "raiseSkeleton")).toEqual({
      ...bar,
      key2: "raiseSkeleton",
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

    expect(placeLearnedSkill(full, "raiseSkeleton")).toEqual(full);
  });
});

describe("PutSkillOnBar", () => {
  /** A Level 2 Hero with the Golem learned, so on the right-click slot. */
  function learned(): World {
    const w = world(withSkillPoints(2, 1));
    spend(w, "raiseSkeleton");
    return w;
  }

  it("puts a learned Skill into a slot, emptying the one it was in, and reports it", () => {
    const w = learned();

    const events = step(w, [
      { type: "PutSkillOnBar", skill: "raiseSkeleton", slot: "key3" },
    ]);

    expect(events).toEqual([{ type: "SkillBarChanged" }]);
    expect(progressOf(w).skillBar).toEqual({
      ...emptySkillBar(),
      key3: "raiseSkeleton",
    });
  });

  it("is ignored for a Skill not yet learned", () => {
    const w = world(withSkillPoints(2, 1));

    const events = step(w, [
      { type: "PutSkillOnBar", skill: "raiseSkeleton", slot: "key1" },
    ]);

    expect(events).toEqual([]);
    expect(progressOf(w).skillBar).toEqual(emptySkillBar());
  });

  it("reports nothing when the Skill is already in that slot", () => {
    const w = learned();

    const events = step(w, [
      { type: "PutSkillOnBar", skill: "raiseSkeleton", slot: "right" },
    ]);

    expect(events).toEqual([]);
    expect(progressOf(w).skillBar.right).toBe("raiseSkeleton");
  });

  it("happens at once, without interrupting a swing", () => {
    const w = learned();
    step(w, [{ type: "SwingAt", target: { x: 2.5, y: 0.5 } }]);
    const swing = w.hero.swing;

    step(w, [{ type: "PutSkillOnBar", skill: "raiseSkeleton", slot: "key1" }]);

    expect(w.hero.swing).toBe(swing);
    expect(progressOf(w).skillBar.key1).toBe("raiseSkeleton");
  });
});

describe("putSkillOnBar", () => {
  // A second Skill, which the tuning doesn't have yet.
  const other = "boneWall" as CastSkill;

  it("swaps it with the Skill in the slot when it came from another slot", () => {
    const bar = {
      ...emptySkillBar(),
      right: other,
      key2: "raiseSkeleton" as CastSkill,
    };

    expect(putSkillOnBar(bar, "raiseSkeleton", "right")).toEqual({
      ...emptySkillBar(),
      right: "raiseSkeleton",
      key2: other,
    });
  });

  it("moves it to an empty slot, emptying the one it came from", () => {
    const bar = { ...emptySkillBar(), key2: "raiseSkeleton" as CastSkill };

    expect(putSkillOnBar(bar, "raiseSkeleton", "key4")).toEqual({
      ...emptySkillBar(),
      key4: "raiseSkeleton",
    });
  });

  it("takes the place of the Skill in the slot when it wasn't on the bar", () => {
    const bar = { ...emptySkillBar(), key1: other };

    expect(putSkillOnBar(bar, "raiseSkeleton", "key1")).toEqual({
      ...emptySkillBar(),
      key1: "raiseSkeleton",
    });
  });

  it("never puts a Skill in two slots", () => {
    const bar = {
      ...emptySkillBar(),
      right: other,
      key3: "raiseSkeleton" as CastSkill,
    };

    for (const slot of SKILL_BAR_SLOTS) {
      const after = putSkillOnBar(bar, "raiseSkeleton", slot);
      const raised = SKILL_BAR_SLOTS.filter(
        (name) => after[name] === "raiseSkeleton",
      );
      const others = SKILL_BAR_SLOTS.filter((name) => after[name] === other);
      expect(raised).toEqual([slot]);
      expect(others).toHaveLength(1);
    }
  });
});

describe("Branches and Prerequisites", () => {
  it("groups every Skill in one Branch, by grid place, the first having none", () => {
    expect(branchSkills).toEqual({
      bone: [
        "boneWard",
        "corpseExplosion",
        "boneSpear",
        "boneWall",
        "splinterVolley",
        "ossifiedWill",
      ],
      summoning: [
        "raiseSkeleton",
        "bonebinding",
        "golem",
        "raiseArcher",
        "graveCommand",
      ],
      curses: [
        "amplifyDamage",
        "weaken",
        "leadenLimbs",
        "dread",
        "lingeringMalice",
      ],
    });
    for (const branch of BRANCHES) {
      expect(skillTuning[branchSkills[branch][0]].prerequisites).toEqual([]);
    }
  });

  it.each([
    ["boneWard", []],
    ["corpseExplosion", ["boneWard"]],
    ["boneSpear", ["corpseExplosion"]],
    ["boneWall", ["boneWard"]],
    ["splinterVolley", ["boneSpear", "boneWall"]],
    ["ossifiedWill", ["splinterVolley"]],
    ["raiseSkeleton", []],
    ["golem", ["raiseSkeleton"]],
    ["raiseArcher", ["raiseSkeleton"]],
    ["graveCommand", ["golem", "raiseArcher"]],
    ["bonebinding", ["raiseSkeleton"]],
    ["amplifyDamage", []],
    ["weaken", ["amplifyDamage"]],
    ["leadenLimbs", ["amplifyDamage"]],
    ["dread", ["leadenLimbs"]],
    ["lingeringMalice", ["weaken", "dread"]],
  ] as const)("shapes %s to hang from %j", (skill, prerequisites) => {
    expect(skillTuning[skill].prerequisites).toEqual(prerequisites);
  });

  it("keeps every Skill's required Level as it was", () => {
    expect(
      Object.fromEntries(
        SKILLS.map((skill) => [skill, skillTuning[skill].requiredLevel]),
      ),
    ).toEqual({
      raiseSkeleton: 1,
      golem: 1,
      amplifyDamage: 2,
      weaken: 5,
      leadenLimbs: 8,
      dread: 10,
      boneWard: 3,
      corpseExplosion: 4,
      boneSpear: 6,
      boneWall: 8,
      splinterVolley: 10,
      raiseArcher: 6,
      ossifiedWill: 12,
      graveCommand: 12,
      bonebinding: 1,
      lingeringMalice: 12,
    });
  });

  it("gives every Skill a place in its Branch's 3 x 6 grid, each Prerequisite above it (or, for a Passive Skill, beside it), no two sharing one, and no loops", () => {
    for (const branch of BRANCHES) {
      const places = new Set<string>();
      for (const skill of branchSkills[branch]) {
        const { grid, prerequisites } = skillTuning[skill];
        expect(Number.isInteger(grid.column)).toBe(true);
        expect(Number.isInteger(grid.row)).toBe(true);
        expect(grid.column).toBeGreaterThanOrEqual(0);
        expect(grid.column).toBeLessThan(BRANCH_GRID.columns);
        expect(grid.row).toBeGreaterThanOrEqual(0);
        expect(grid.row).toBeLessThan(BRANCH_GRID.rows);
        places.add(`${grid.column},${grid.row}`);
        for (const before of prerequisites) {
          expect(skillTuning[before].branch).toBe(branch);
          const above = skillTuning[before].grid;
          // A Passive Skill may sit beside its Prerequisite, on its right.
          expect(
            above.row < grid.row ||
              (isPassive(skill) &&
                above.row === grid.row &&
                above.column < grid.column),
          ).toBe(true);
        }
      }
      expect(places.size).toBe(branchSkills[branch].length);
    }
  });

  it("draws no two arrows across each other in a Branch's grid", () => {
    // Arrows run centre to centre; two cross when their ends interleave.
    const side = (a: GridPlace, b: GridPlace, p: GridPlace) =>
      Math.sign(
        (b.column - a.column) * (p.row - a.row) -
          (b.row - a.row) * (p.column - a.column),
      );
    for (const branch of BRANCHES) {
      const arrows = branchSkills[branch].flatMap((skill) =>
        skillTuning[skill].prerequisites.map((before) => [
          skillTuning[before].grid,
          skillTuning[skill].grid,
        ]),
      );
      arrows.forEach(([a, b], i) => {
        for (const [c, d] of arrows.slice(i + 1)) {
          const shared = [a, b].some((p) => p === c || p === d);
          if (shared) continue;
          const crossing =
            side(a, b, c) * side(a, b, d) < 0 &&
            side(c, d, a) * side(c, d, b) < 0;
          expect(crossing).toBe(false);
        }
      });
    }
  });

  /** A Level 6 Hero with Skill Points to spare and `learned` Skill Levels. */
  function level6(learned: Partial<Record<Skill, number>>): World {
    return world({
      ...FRESH_PROGRESS,
      level: 6,
      experience: 3_750,
      skillPoints: 5,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, ...learned },
    });
  }

  it("spends nothing on a Skill whose Prerequisite is at Skill Level 0", () => {
    const w = level6({});

    expect(spend(w, "golem")).toEqual([]);
    expect(spend(w, "boneSpear")).toEqual([]);
    expect(progressOf(w)).toMatchObject({ skillPoints: 5 });
  });

  it("spends a Skill Point once the Prerequisite has a Skill Level", () => {
    const w = level6({});

    spend(w, "raiseSkeleton");

    expect(spend(w, "golem")).toEqual([
      { type: "SkillLevelRaised", skill: "golem", skillLevel: 1 },
    ]);
  });

  it("spends nothing on a Skill with two Prerequisites while only one is learned", () => {
    const w = level6({ boneWard: 1, corpseExplosion: 1, boneSpear: 1 });
    w.hero.progress.level = 12;

    expect(spend(w, "splinterVolley")).toEqual([]);
    expect(canRaiseSkill(w, "splinterVolley")).toBe(false);
  });

  it("spends a Skill Point on a Skill with two Prerequisites once both are learned", () => {
    const w = level6({
      boneWard: 1,
      corpseExplosion: 1,
      boneSpear: 1,
      boneWall: 1,
    });
    w.hero.progress.level = 12;

    expect(spend(w, "splinterVolley")).toEqual([
      { type: "SkillLevelRaised", skill: "splinterVolley", skillLevel: 1 },
    ]);
  });

  it("still needs the Hero's Level with the Prerequisite learned", () => {
    const w = level6({ boneWard: 1, corpseExplosion: 1 });
    w.hero.progress.level = skillTuning.boneSpear.requiredLevel - 1;

    expect(spend(w, "boneSpear")).toEqual([]);
  });
});
