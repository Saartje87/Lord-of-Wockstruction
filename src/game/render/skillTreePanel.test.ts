import { describe, expect, it } from "vitest";
import {
  createWorld,
  FRESH_PROGRESS,
  type Progress,
  step,
  type World,
} from "../sim/world";
import {
  BRANCHES,
  branchSkills,
  type Skill,
  skillTuning,
} from "../tuning/skills";
import { viewportOf } from "../viewport";
import { inventoryPanelLayout } from "./inventoryPanel";
import {
  SKILL_TREE_PANEL,
  skillTreeBranchRow,
  skillTreeColumns,
  skillTreeFocusSpots,
  skillTreeHitAt,
  skillTreePanelLayout,
  skillTreePanelRect,
  skillTreeSheet,
  skillTreeSkillRow,
  tunedRooms,
} from "./skillTreePanel";

/**
 * A Town of three tiles in a row, the Hero's `start` on the first and a
 * Skeleton on the last.
 */
const town = {
  orientation: "orthogonal",
  width: 3,
  height: 1,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "floor", width: 3, height: 1, data: [1, 1, 1] },
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
            { name: "count", type: "int", value: 1 },
          ],
        },
      ],
    },
  ],
};

function world(progress?: Progress): World {
  return createWorld({ areas: { town }, seed: 1, progress });
}

/** A Level 3 Hero with the Golem at `golem` and the rest of their 2 Skill Points unspent. */
function withGolem(golem: number): World {
  return world({
    ...FRESH_PROGRESS,
    level: 3,
    experience: 1_500,
    attributePoints: 10,
    skillPoints: 2 - golem,
    skillLevels: { ...FRESH_PROGRESS.skillLevels, raiseSkeleton: 1, golem },
  });
}

/** Stands still by the Skeleton until it kills the Hero. */
function kill(w: World) {
  for (let i = 0; !w.death; i++) {
    if (i > 60 * 60) throw new Error("The Hero didn't die");
    step(w, []);
  }
}

/** The rows of a Belt Column with no Belt Equipped. */
const ONE_ROW = 1;

/** The sheet's row of `skill`. */
const rowOf = (w: World, skill: Skill) => {
  const found = skillTreeSheet(w).skills.find((row) => row.skill === skill);
  if (!found) throw new Error(`No row for ${skill}`);
  return found;
};

describe("skillTreeSheet", () => {
  it("shows a New Hero's Skills unlearned, with what Skill Level 1 costs", () => {
    const sheet = skillTreeSheet(world());
    const order: Skill[] = [
      "boneWard",
      "corpseExplosion",
      "boneSpear",
      "boneWall",
      "splinterVolley",
      "ossifiedWill",
      "raiseSkeleton",
      "golem",
      "raiseArcher",
      "graveCommand",
      "amplifyDamage",
      "weaken",
      "leadenLimbs",
      "dread",
      "lingeringMalice",
    ];

    expect(sheet.skillPoints).toBe("0");
    expect(sheet.skills.map((row) => row.skill)).toEqual(order);
    expect(sheet.skills.map((row) => row.canRaise)).toEqual(
      order.map(() => false),
    );
    expect(rowOf(world(), "golem")).toMatchObject({
      name: "Golem",
      skillLevel: "0",
      manaCost: "15",
      requiredLevel: null,
    });
    expect(rowOf(world(), "boneSpear")).toMatchObject({
      name: "Bone Spear",
      skillLevel: "0",
      manaCost: "7",
      requiredLevel: "6",
    });
  });

  it("groups the Skills in Bone, Summoning and Curses, each in Prerequisite order", () => {
    const sheet = skillTreeSheet(world());

    expect(sheet.branches.map((b) => b.name)).toEqual([
      "Bone",
      "Summoning",
      "Curses",
    ]);
    expect(sheet.skills.map((row) => [row.branch, row.skill])).toEqual(
      BRANCHES.flatMap((branch) =>
        branchSkills[branch].map((skill) => [branch, skill]),
      ),
    );
  });

  it("names the Prerequisite holding a Skill back until it has a Skill Level", () => {
    const bare = world({
      ...FRESH_PROGRESS,
      level: 3,
      experience: 1_500,
      skillPoints: 2,
    });

    expect(rowOf(bare, "golem")).toMatchObject({
      prerequisites: [skillTuning.raiseSkeleton.name],
      canRaise: false,
    });
    expect(rowOf(withGolem(0), "golem")).toMatchObject({
      prerequisites: [],
      canRaise: true,
    });
    // The first of a Branch has none.
    expect(rowOf(bare, "boneWard")).toMatchObject({
      prerequisites: [],
      canRaise: true,
    });
  });

  it("names every Prerequisite still without a Skill Level, and drops each once learned", () => {
    const progress = {
      ...FRESH_PROGRESS,
      level: 12,
      experience: 100_000,
      skillPoints: 2,
    };

    expect(rowOf(world(progress), "graveCommand").prerequisites).toEqual([
      skillTuning.golem.name,
      skillTuning.raiseArcher.name,
    ]);
    const learned = {
      ...progress,
      skillLevels: { ...progress.skillLevels, golem: 1 },
    };
    expect(rowOf(world(learned), "graveCommand")).toMatchObject({
      prerequisites: [skillTuning.raiseArcher.name],
      canRaise: false,
    });
  });

  it("lists a Skill's Synergies with what they add now, from the givers' Skill Levels", () => {
    const [synergy] = skillTuning.corpseExplosion.synergies;
    if (!synergy) throw new Error("No Synergy");
    const giver = skillTuning[synergy.skill].name;
    const percent = String(synergy.percentPerSkillLevel);
    const w = world({
      ...FRESH_PROGRESS,
      level: 10,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, [synergy.skill]: 3 },
    });

    expect(rowOf(w, "corpseExplosion")).toMatchObject({
      synergies: [
        {
          giver,
          percentPerSkillLevel: percent,
          total: String(synergy.percentPerSkillLevel * 3),
        },
      ],
      synergyTotal: String(synergy.percentPerSkillLevel * 3),
    });
    expect(rowOf(w, "boneWall")).toMatchObject({
      synergies: [],
      synergyTotal: "0",
    });
  });

  it("marks Passive Skills, with no Mana cost, and what they add now", () => {
    const { percentPerSkillLevel } = skillTuning.graveCommand.passive;
    const w = world({
      ...FRESH_PROGRESS,
      level: 20,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, graveCommand: 3 },
    });

    expect(rowOf(w, "graveCommand")).toMatchObject({
      manaCost: "",
      passive: {
        percentPerSkillLevel: String(percentPerSkillLevel),
        total: String(percentPerSkillLevel * 3),
      },
      synergies: [],
    });
    expect(rowOf(w, "golem").passive).toBeNull();
  });

  it("shows the Mana cost at the next Skill Level, and a + while a point is unspent", () => {
    const w = withGolem(0);
    const golemRow = () => rowOf(w, "golem");

    expect(skillTreeSheet(w).skillPoints).toBe("2");
    expect(golemRow()).toMatchObject({
      skillLevel: "0",
      manaCost: "15",
      canRaise: true,
    });

    step(w, [{ type: "SpendSkillPoint", skill: "golem" }]);
    expect(skillTreeSheet(w).skillPoints).toBe("1");
    expect(golemRow()).toMatchObject({
      skillLevel: "1",
      manaCost: "17",
      canRaise: true,
    });

    step(w, [{ type: "SpendSkillPoint", skill: "golem" }]);
    expect(skillTreeSheet(w).skillPoints).toBe("0");
    expect(golemRow()).toMatchObject({
      skillLevel: "2",
      manaCost: "19",
      canRaise: false,
    });
  });

  it("shows the required Level, and no +, until the Hero reaches it", () => {
    skillTuning.golem.requiredLevel = 6;

    expect(rowOf(withGolem(0), "golem")).toMatchObject({
      requiredLevel: "6",
      canRaise: false,
    });

    skillTuning.golem.requiredLevel = 3;
    expect(rowOf(withGolem(0), "golem")).toMatchObject({
      requiredLevel: null,
      canRaise: true,
    });
  });

  it("shows no + while the Hero is dead", () => {
    const w = withGolem(0);
    kill(w);

    expect(rowOf(w, "golem").canRaise).toBe(false);
  });
});

describe("skillTreeHitAt", () => {
  const screen = viewportOf({ width: 1280, height: 720 });
  const layout = skillTreePanelLayout(screen);
  const centre = (rect: { x: number; y: number; w: number; h: number }) => ({
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  });

  it("sits where the Inventory panel does, at the right", () => {
    const inventory = inventoryPanelLayout(screen, ONE_ROW).panel;

    expect(layout.panel.x + layout.panel.w).toBe(inventory.x + inventory.w);
    expect(layout.panel.y).toBe(inventory.y);
  });

  it("finds a Skill's + only while the panel is open and it can be raised", () => {
    const at = centre(layout.raise.golem);

    expect(skillTreeHitAt(screen, at, withGolem(1), true)).toEqual({
      button: { type: "learn", skill: "golem" },
    });
    // No + without a Skill Point: there it's just the learned Skill's rows.
    expect(skillTreeHitAt(screen, at, withGolem(2), true)).toEqual({
      button: { type: "pickUpSkill", skill: "golem" },
    });
    expect(skillTreeHitAt(screen, at, withGolem(1), false)).toBeNull();
  });

  it("finds no + below the Skill's required Level", () => {
    skillTuning.golem.requiredLevel = 6;
    const at = centre(layout.raise.golem);

    expect(skillTreeHitAt(screen, at, withGolem(0), true)).toEqual({
      button: null,
    });
  });

  it("picks up a learned Skill pressed anywhere on its rows but its +", () => {
    const skill = layout.skills.golem;
    const nameRow = { x: skill.x + 4, y: skill.y + 4 };
    const lastRow = { x: skill.x + skill.w - 4, y: skill.y + skill.h - 4 };
    const drag = { button: { type: "pickUpSkill", skill: "golem" } };

    expect(skillTreeHitAt(screen, nameRow, withGolem(1), true)).toEqual(drag);
    expect(skillTreeHitAt(screen, lastRow, withGolem(2), true)).toEqual(drag);
    expect(skillTreeHitAt(screen, nameRow, withGolem(1), false)).toBeNull();
  });

  it("can't pick up a learned Passive Skill", () => {
    const skill = layout.skills.lingeringMalice;
    const at = { x: skill.x + 4, y: skill.y + 4 };
    const w = world({
      ...FRESH_PROGRESS,
      level: 20,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, lingeringMalice: 2 },
    });

    expect(skillTreeHitAt(screen, at, w, true)).toEqual({ button: null });
  });

  it("gives a learned Passive Skill's Focus spot no second hit to pick it up", () => {
    const w = world({
      ...FRESH_PROGRESS,
      level: 20,
      skillLevels: {
        ...FRESH_PROGRESS.skillLevels,
        golem: 1,
        lingeringMalice: 2,
      },
    });
    const spots = skillTreeFocusSpots(w, screen);
    const spotOf = (skill: Skill) =>
      spots.find(
        (spot) =>
          JSON.stringify(spot.rect) === JSON.stringify(layout.skills[skill]),
      );

    expect(spotOf("golem")?.secondHit).toEqual({
      button: { type: "pickUpSkill", skill: "golem" },
    });
    expect(spotOf("lingeringMalice")?.secondHit).toBeUndefined();
  });

  it("can't pick up a Skill not yet learned", () => {
    const skill = layout.skills.golem;
    const at = { x: skill.x + 4, y: skill.y + 4 };

    expect(skillTreeHitAt(screen, at, withGolem(0), true)).toEqual({
      button: null,
    });
  });

  it("gives each Skill one row under the Skill Points, its + inside it", () => {
    const skill = layout.skills.golem;
    const plus = layout.raise.golem;

    expect(skill.h).toBe(24);
    expect(skill.y).toBeGreaterThan(layout.panel.y + 56 + 24);
    expect(plus.y).toBeGreaterThanOrEqual(skill.y);
    expect(plus.y + plus.h).toBeLessThanOrEqual(skill.y + skill.h);
    expect(plus.x + plus.w).toBe(skill.x + skill.w);
    expect(skill.y + skill.h).toBeLessThan(layout.panel.y + layout.panel.h);
  });

  it("puts a Skill's required Level, Skill Level and Mana cost left to right before its +, leaving room for its name", () => {
    const row = layout.skills.golem;
    const columns = skillTreeColumns(screen, row);

    // Room for "Corpse Explosion", the longest name to come.
    expect(columns.requiredLevel).toBeGreaterThanOrEqual(row.x + 120);
    expect(columns.skillLevel).toBeGreaterThan(columns.requiredLevel + 60);
    expect(columns.manaCost).toBeGreaterThan(columns.skillLevel + 30);
    expect(columns.manaCost).toBeLessThan(layout.raise.golem.x);
  });

  it("finds the × above the open panel's Skills", () => {
    const { closeButton } = layout;
    const at = centre(closeButton);

    expect(closeButton.y + closeButton.h).toBeLessThanOrEqual(
      layout.skills.golem.y,
    );
    expect(skillTreeHitAt(screen, at, withGolem(1), true)).toEqual({
      button: { type: "close", panel: "skillTree" },
    });
    expect(skillTreeHitAt(screen, at, withGolem(1), false)).toBeNull();
  });

  it.each([
    { width: 1024, height: 600 },
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ])("fits 15 Skills in three Branches over its hint, on the screen, on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const rooms = tunedRooms();
    const panel = skillTreePanelRect(viewport, rooms);
    const hint =
      (SKILL_TREE_PANEL.hintHeight + SKILL_TREE_PANEL.padding) *
      viewport.uiScale;

    expect(viewport.compact).toBe(false);
    expect(rooms).toEqual({ bone: 6, summoning: 4, curses: 5 });
    expect(panel.y + panel.h).toBeLessThanOrEqual(size.height);
    let previous = skillTreePanelLayout(viewport, rooms).closeButton.y;
    for (const branch of BRANCHES) {
      const rows = [
        skillTreeBranchRow(viewport, branch, rooms),
        ...Array.from({ length: rooms[branch] }, (_, i) =>
          skillTreeSkillRow(viewport, branch, i, rooms),
        ),
      ];
      for (const row of rows) {
        expect(row.y).toBeGreaterThanOrEqual(previous - 1e-6);
        expect(row.y + row.h).toBeLessThanOrEqual(panel.y + panel.h - hint);
        previous = row.y + row.h;
      }
    }
  });

  it("catches anywhere else on the open panel, and nothing off it", () => {
    const { panel } = layout;
    const inside = { x: panel.x + 2, y: panel.y + panel.h - 2 };
    const outside = { x: panel.x - 2, y: panel.y + 2 };

    expect(skillTreeHitAt(screen, inside, withGolem(0), true)).toEqual({
      button: null,
    });
    expect(skillTreeHitAt(screen, inside, withGolem(0), false)).toBeNull();
    expect(skillTreeHitAt(screen, outside, withGolem(0), true)).toBeNull();
  });
});
