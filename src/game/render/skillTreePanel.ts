import { inside, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import {
  canRaiseSkill,
  SKILLS,
  type Skill,
  skillManaCost,
  type World,
} from "../sim/world";
import { skillTuning } from "../tuning/skills";

/**
 * The Skill Tree panel at the top right, where the Inventory panel goes
 * (CSS px): `right` and `top` from the screen's corner, its rows
 * `rowHeight` apart from `firstRow` down, `hintHeight` under them for its
 * hint, and each Skill's + button `plus` square at the right of its name.
 */
export const SKILL_TREE_PANEL = {
  right: 16,
  top: 16,
  width: 300,
  padding: 18,
  firstRow: 56,
  rowHeight: 28,
  hintHeight: 28,
  plus: 22,
};

/**
 * The rows of the panel under its title: the unspent Skill Points, a gap,
 * then each Skill's rows (its name, Skill Level, Mana cost and required
 * Level) and a gap after them.
 */
export const SKILL_TREE_ROWS = {
  skillPoints: 0,
  firstSkill: 2,
  /** Rows each Skill takes, its gap included. */
  perSkill: 5,
  /** Within a Skill's rows. */
  name: 0,
  skillLevel: 1,
  manaCost: 2,
  requiredLevel: 3,
} as const;

/** What the Skill Tree panel shows of a Skill, as text. */
export type SkillSheet = {
  skill: Skill;
  name: string;
  skillLevel: string;
  /** What a cast costs at the next Skill Level: what a + buys. */
  manaCost: string;
  requiredLevel: string;
  /** Whether a Skill Point can be spent on it now, so its + shows. */
  canRaise: boolean;
};

/** What the Skill Tree panel shows of the Hero, as text. */
export type SkillTreeSheet = { skillPoints: string; skills: SkillSheet[] };

export function skillTreeSheet(world: World): SkillTreeSheet {
  const { progress } = world.hero;
  return {
    skillPoints: String(progress.skillPoints),
    skills: SKILLS.map((skill) => {
      const skillLevel = progress.skillLevels[skill];
      return {
        skill,
        name: skillTuning[skill].name,
        skillLevel: String(skillLevel),
        manaCost: String(skillManaCost(skill, skillLevel + 1)),
        requiredLevel: String(skillTuning[skill].requiredLevel),
        canRaise: canRaiseSkill(world, skill),
      };
    }),
  };
}

/** The top of the panel's row `row` (CSS px). */
export function skillTreeRowTop(row: number): number {
  const { top, firstRow, rowHeight } = SKILL_TREE_PANEL;
  return top + firstRow + row * rowHeight;
}

/** The panel row of row `row` within the `index`th Skill's rows. */
export function skillRow(index: number, row: number): number {
  return SKILL_TREE_ROWS.firstSkill + index * SKILL_TREE_ROWS.perSkill + row;
}

/** Where the panel and each Skill's + button are drawn. */
export function skillTreePanelLayout(screen: { width: number }): {
  panel: Rect;
  raise: Record<Skill, Rect>;
} {
  const { right, top, width, padding, rowHeight, hintHeight, plus } =
    SKILL_TREE_PANEL;
  const x = screen.width - right - width;
  const rows = skillRow(SKILLS.length, 0) - 1;
  const panel = {
    x,
    y: top,
    w: width,
    h: skillTreeRowTop(rows) + hintHeight + padding - top,
  };
  const plusAt = (index: number): Rect => ({
    x: x + width - padding - plus,
    y:
      skillTreeRowTop(skillRow(index, SKILL_TREE_ROWS.name)) +
      (rowHeight - plus) / 2,
    w: plus,
    h: plus,
  });
  return {
    panel,
    raise: Object.fromEntries(
      SKILLS.map((skill, index) => [skill, plusAt(index)]),
    ) as Record<Skill, Rect>,
  };
}

/**
 * A click on the open Skill Tree panel, so not for the World: the Skill
 * whose + it pressed, or null between the buttons.
 */
export type SkillTreeHit = { button: { type: "learn"; skill: Skill } | null };

/**
 * What a click at `point` hits of the Skill Tree panel, or null when it's
 * off it or the panel isn't `open`, so it's for the World. A Skill's +
 * button is there only while a Skill Point can be spent on it.
 */
export function skillTreeHitAt(
  screen: { width: number },
  point: Vec,
  world: World,
  open: boolean,
): SkillTreeHit | null {
  const layout = skillTreePanelLayout(screen);
  if (!open || !inside(layout.panel, point)) return null;
  for (const skill of SKILLS) {
    if (canRaiseSkill(world, skill) && inside(layout.raise[skill], point)) {
      return { button: { type: "learn", skill } };
    }
  }
  return { button: null };
}
