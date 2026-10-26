import { afterEach, describe, expect, it } from "vitest";
import {
  createWorld,
  FRESH_PROGRESS,
  type Progress,
  step,
  type World,
} from "../sim/world";
import { skillTuning } from "../tuning/skills";
import { inventoryPanelLayout } from "./inventoryPanel";
import {
  skillTreeHitAt,
  skillTreePanelLayout,
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
    skillLevels: { golem },
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

describe("skillTreeSheet", () => {
  it("shows a New Hero's Golem unlearned, with what Skill Level 1 costs", () => {
    expect(skillTreeSheet(world())).toEqual({
      skillPoints: "0",
      skills: [
        {
          skill: "golem",
          name: "Golem",
          skillLevel: "0",
          manaCost: "15",
          requiredLevel: "1",
          canRaise: false,
        },
      ],
    });
  });

  it("shows the Mana cost at the next Skill Level, and a + while a point is unspent", () => {
    const w = withGolem(0);

    expect(skillTreeSheet(w)).toMatchObject({
      skillPoints: "2",
      skills: [{ skillLevel: "0", manaCost: "15", canRaise: true }],
    });

    step(w, [{ type: "SpendSkillPoint", skill: "golem" }]);
    expect(skillTreeSheet(w)).toMatchObject({
      skillPoints: "1",
      skills: [{ skillLevel: "1", manaCost: "17", canRaise: true }],
    });

    step(w, [{ type: "SpendSkillPoint", skill: "golem" }]);
    expect(skillTreeSheet(w)).toMatchObject({
      skillPoints: "0",
      skills: [{ skillLevel: "2", manaCost: "19", canRaise: false }],
    });
  });

  it("shows no + below the Skill's required Level", () => {
    skillTuning.golem.requiredLevel = 6;

    expect(skillTreeSheet(withGolem(0))).toMatchObject({
      skills: [{ requiredLevel: "6", canRaise: false }],
    });
  });

  it("shows no + while the Hero is dead", () => {
    const w = withGolem(0);
    kill(w);

    expect(skillTreeSheet(w).skills[0].canRaise).toBe(false);
  });
});

describe("skillTreeHitAt", () => {
  const screen = { width: 1280, height: 720 };
  const layout = skillTreePanelLayout(screen);
  const centre = (rect: { x: number; y: number; w: number; h: number }) => ({
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  });

  it("sits where the Inventory panel does, at the right", () => {
    const inventory = inventoryPanelLayout(screen).panel;

    expect(layout.panel.x + layout.panel.w).toBe(inventory.x + inventory.w);
    expect(layout.panel.y).toBe(inventory.y);
  });

  it("finds a Skill's + only while the panel is open and it can be raised", () => {
    const at = centre(layout.raise.golem);

    expect(skillTreeHitAt(screen, at, withGolem(1), true)).toEqual({
      button: { type: "learn", skill: "golem" },
    });
    expect(skillTreeHitAt(screen, at, withGolem(2), true)).toEqual({
      button: null,
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
