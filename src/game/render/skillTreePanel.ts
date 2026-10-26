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
import { atUiScale, type Viewport } from "../viewport";
import { type CloseButton, closeButtonRect, closeHitAt } from "./closeButton";

/**
 * The Skill Tree panel at the top right, where the Inventory panel goes
 * (CSS px at native scale, drawn at the UI Scale): `right` and `top` from the screen's corner, its rows
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

/** What the Skill Tree panel shows, from the Hero's progress. */
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

/** The top of the panel's row `row` (CSS px), at the UI Scale. */
export function skillTreeRowTop(screen: Viewport, row: number): number {
  const { top, firstRow, rowHeight } = atUiScale(
    SKILL_TREE_PANEL,
    screen.uiScale,
  );
  return top + firstRow + row * rowHeight;
}

/** The panel row of row `row` within the `index`th Skill's rows. */
export function skillRow(index: number, row: number): number {
  return SKILL_TREE_ROWS.firstSkill + index * SKILL_TREE_ROWS.perSkill + row;
}

/**
 * Where the panel and its × close button are drawn, each Skill's rows (where
 * pressing a learned Skill picks it up to drag onto the Skill Bar) and each
 * Skill's + button.
 */
export function skillTreePanelLayout(screen: Viewport): {
  panel: Rect;
  closeButton: Rect;
  skills: Record<Skill, Rect>;
  raise: Record<Skill, Rect>;
} {
  const { right, top, width, padding, rowHeight, hintHeight, plus } = atUiScale(
    SKILL_TREE_PANEL,
    screen.uiScale,
  );
  const rowTop = (row: number) => skillTreeRowTop(screen, row);
  const x = screen.width - right - width;
  const rows = skillRow(SKILLS.length, 0) - 1;
  const panel = {
    x,
    y: top,
    w: width,
    h: rowTop(rows) + hintHeight + padding - top,
  };
  const plusAt = (index: number): Rect => ({
    x: x + width - padding - plus,
    y: rowTop(skillRow(index, SKILL_TREE_ROWS.name)) + (rowHeight - plus) / 2,
    w: plus,
    h: plus,
  });
  const rowsOf = (index: number): Rect => {
    const y = rowTop(skillRow(index, SKILL_TREE_ROWS.name));
    const end = rowTop(skillRow(index, SKILL_TREE_ROWS.requiredLevel + 1));
    return { x: x + padding, y, w: width - 2 * padding, h: end - y };
  };
  return {
    panel,
    closeButton: closeButtonRect(panel, screen.uiScale),
    skills: Object.fromEntries(
      SKILLS.map((skill, index) => [skill, rowsOf(index)]),
    ) as Record<Skill, Rect>,
    raise: Object.fromEntries(
      SKILLS.map((skill, index) => [skill, plusAt(index)]),
    ) as Record<Skill, Rect>,
  };
}

/**
 * A click on the open Skill Tree panel, so not for the World: the ×, the
 * Skill whose + it pressed, the learned Skill it picked up to drag onto the
 * Skill Bar, or null elsewhere.
 */
export type SkillTreeHit = {
  button:
    | { type: "learn"; skill: Skill }
    | { type: "pickUpSkill"; skill: Skill }
    | CloseButton
    | null;
};

/**
 * What a click at `point` hits of the Skill Tree panel, or null when it's
 * off it or the panel isn't `open`, so it's for the World. A Skill's +
 * button is there only while a Skill Point can be spent on it; the rest of
 * a learned Skill's rows pick it up.
 */
export function skillTreeHitAt(
  screen: Viewport,
  point: Vec,
  world: World,
  open: boolean,
): SkillTreeHit | null {
  const layout = skillTreePanelLayout(screen);
  if (!open || !inside(layout.panel, point)) return null;
  const closeHit = closeHitAt(layout, point, "skillTree");
  if (closeHit) return closeHit;
  for (const skill of SKILLS) {
    if (canRaiseSkill(world, skill) && inside(layout.raise[skill], point)) {
      return { button: { type: "learn", skill } };
    }
    const learned = world.hero.progress.skillLevels[skill] > 0;
    if (learned && inside(layout.skills[skill], point)) {
      return { button: { type: "pickUpSkill", skill } };
    }
  }
  return { button: null };
}
