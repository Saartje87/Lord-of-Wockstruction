import { afterEach, describe, expect, it } from "vitest";
import {
  createWorld,
  FRESH_PROGRESS,
  type Progress,
  step,
  type World,
} from "../sim/world";
import { skillTuning } from "../tuning/skills";
import { viewportOf } from "../viewport";
import { inventoryPanelLayout } from "./inventoryPanel";
import {
  SKILL_TREE_PANEL,
  skillRow,
  skillTreeColumns,
  skillTreeHitAt,
  skillTreePanelLayout,
  skillTreePanelRect,
  skillTreeRow,
  skillTreeSheet,
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
    skillLevels: { ...FRESH_PROGRESS.skillLevels, golem },
  });
}

/** Stands still by the Skeleton until it kills the Hero. */
function kill(w: World) {
  for (let i = 0; !w.death; i++) {
    if (i > 60 * 60) throw new Error("The Hero didn't die");
    step(w, []);
  }
}

const golemRequiredLevel = skillTuning.golem.requiredLevel;
afterEach(() => {
  skillTuning.golem.requiredLevel = golemRequiredLevel;
});

/** The rows of a Belt Column with no Belt Equipped. */
const ONE_ROW = 1;

/** The Skills the Skill Tree must fit: Golem and Necromancy's five. */
const SIX_SKILLS = 6;

describe("skillTreeSheet", () => {
  it("shows a New Hero's Skills unlearned, with what Skill Level 1 costs", () => {
    expect(skillTreeSheet(world())).toEqual({
      skillPoints: "0",
      skills: [
        {
          skill: "golem",
          name: "Golem",
          skillLevel: "0",
          manaCost: "15",
          requiredLevel: null,
          canRaise: false,
        },
        {
          skill: "raiseSkeleton",
          name: "Raise Skeleton",
          skillLevel: "0",
          manaCost: "6",
          requiredLevel: null,
          canRaise: false,
        },
        {
          skill: "corpseExplosion",
          name: "Corpse Explosion",
          skillLevel: "0",
          manaCost: "15",
          requiredLevel: "4",
          canRaise: false,
        },
      ],
    });
  });

  it("shows the Mana cost at the next Skill Level, and a + while a point is unspent", () => {
    const w = withGolem(0);
    const golemRow = () => skillTreeSheet(w).skills[0];

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

    expect(skillTreeSheet(withGolem(0)).skills[0]).toMatchObject({
      requiredLevel: "6",
      canRaise: false,
    });

    skillTuning.golem.requiredLevel = 3;
    expect(skillTreeSheet(withGolem(0)).skills[0]).toMatchObject({
      requiredLevel: null,
      canRaise: true,
    });
  });

  it("shows no + while the Hero is dead", () => {
    const w = withGolem(0);
    kill(w);

    expect(skillTreeSheet(w).skills[0].canRaise).toBe(false);
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

    expect(skill.h).toBe(26);
    expect(skill.y).toBeGreaterThan(layout.panel.y + 56 + 26);
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
  ])("fits six Skills' rows over its hint, on the screen, on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const panel = skillTreePanelRect(viewport, SIX_SKILLS);
    const last = skillTreeRow(viewport, skillRow(SIX_SKILLS - 1));
    const hint =
      (SKILL_TREE_PANEL.hintHeight + SKILL_TREE_PANEL.padding) *
      viewport.uiScale;

    expect(viewport.compact).toBe(false);
    expect(panel.y + panel.h).toBeLessThanOrEqual(size.height);
    expect(last.y + last.h).toBeLessThanOrEqual(panel.y + panel.h - hint);
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
