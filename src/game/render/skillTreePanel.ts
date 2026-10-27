import { inside, middleOf, type Rect } from "../sim/rect";
import { SKILL_BAR_SLOTS } from "../sim/skillBar";
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
import { compactPanelRect } from "./compactLayout";
import { type SkillBarHit, skillBarLayout } from "./skillBar";

/**
 * The Skill Tree panel at the top right, where the Inventory panel goes
 * (CSS px at native scale, drawn at the UI Scale): `right` and `top` from the screen's corner, its rows
 * `rowHeight` apart from `firstRow` down, `hintHeight` under them for its
 * hint, and each Skill's + button `plus` square at the right of its name.
 */
export const SKILL_TREE_PANEL = {
  right: 16,
  top: 16,
  width: 320,
  padding: 18,
  firstRow: 56,
  rowHeight: 26,
  hintHeight: 28,
  plus: 22,
};

/**
 * How far left of a Skill's row's right edge its columns go (CSS px at
 * native scale, drawn at the UI Scale): where its required Level starts,
 * and where its Skill Level and its Mana cost end, clear of its +.
 */
export const SKILL_TREE_COLUMNS = {
  requiredLevel: 156,
  skillLevel: 78,
  manaCost: 32,
};

/**
 * The rows of the panel under its title: the unspent Skill Points, the
 * headings over the Skills' columns, then one row for each Skill.
 */
export const SKILL_TREE_ROWS = {
  skillPoints: 0,
  headings: 1,
  firstSkill: 2,
} as const;

/** What the Skill Tree panel shows of a Skill, as text. */
export type SkillSheet = {
  skill: Skill;
  name: string;
  skillLevel: string;
  /** What a cast costs at the next Skill Level: what a + buys. */
  manaCost: string;
  /** The Level the Hero must reach to spend a Skill Point on it, until then. */
  requiredLevel: string | null;
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
      const { requiredLevel } = skillTuning[skill];
      return {
        skill,
        name: skillTuning[skill].name,
        skillLevel: String(skillLevel),
        manaCost: String(skillManaCost(skill, skillLevel + 1)),
        requiredLevel:
          progress.level < requiredLevel ? String(requiredLevel) : null,
        canRaise: canRaiseSkill(world, skill),
      };
    }),
  };
}

/**
 * Where the panel's row `row` is drawn (CSS px), at the UI Scale: its name
 * goes at its left and its value at its right. The rows run down the panel
 * from under its title, inside its padding; in the Compact Layout, where
 * the panel fills the screen, as wide as on a desktop and centred.
 */
export function skillTreeRow(screen: Viewport, row: number): Rect {
  const { width, padding, firstRow, rowHeight } = atUiScale(
    SKILL_TREE_PANEL,
    screen.uiScale,
  );
  const panel = skillTreePanelRect(screen);
  const w = width - 2 * padding;
  return {
    x: panel.x + (panel.w - w) / 2,
    y: panel.y + firstRow + row * rowHeight,
    w,
    h: rowHeight,
  };
}

/**
 * Where the panel itself is drawn: at the top right, as tall as its rows
 * for `skills` Skills, or in the Compact Layout filling the screen.
 */
export function skillTreePanelRect(
  screen: Viewport,
  skills: number = SKILLS.length,
): Rect {
  if (screen.compact) return compactPanelRect(screen);
  const { right, top, width, padding, firstRow, rowHeight, hintHeight } =
    atUiScale(SKILL_TREE_PANEL, screen.uiScale);
  const rows = skillRow(skills);
  return {
    x: screen.width - right - width,
    y: top,
    w: width,
    h: firstRow + rows * rowHeight + hintHeight + padding,
  };
}

/**
 * Where a Skill's row `row` puts its columns (CSS px), at the UI Scale: the
 * x its required Level starts at, and the x its Skill Level and its Mana
 * cost end at. The headings over them line up the same way.
 */
export function skillTreeColumns(
  screen: Viewport,
  row: Rect,
): { requiredLevel: number; skillLevel: number; manaCost: number } {
  const right = row.x + row.w;
  const at = atUiScale(SKILL_TREE_COLUMNS, screen.uiScale);
  return {
    requiredLevel: right - at.requiredLevel,
    skillLevel: right - at.skillLevel,
    manaCost: right - at.manaCost,
  };
}

/** The panel row of the `index`th Skill. */
export function skillRow(index: number): number {
  return SKILL_TREE_ROWS.firstSkill + index;
}

/**
 * Where the panel and its × close button are drawn, each Skill's row (where
 * pressing a learned Skill picks it up to drag onto the Skill Bar) and each
 * Skill's + button.
 */
export function skillTreePanelLayout(screen: Viewport): {
  panel: Rect;
  closeButton: Rect;
  skills: Record<Skill, Rect>;
  raise: Record<Skill, Rect>;
} {
  const { rowHeight, plus } = atUiScale(SKILL_TREE_PANEL, screen.uiScale);
  const panel = skillTreePanelRect(screen);
  const row = (index: number) => skillTreeRow(screen, skillRow(index));
  const plusAt = (index: number): Rect => {
    const at = row(index);
    return {
      x: at.x + at.w - plus,
      y: at.y + (rowHeight - plus) / 2,
      w: plus,
      h: plus,
    };
  };
  return {
    panel,
    closeButton: closeButtonRect(panel, screen.uiScale),
    skills: Object.fromEntries(
      SKILLS.map((skill, index) => [skill, row(index)]),
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

/**
 * A spot the Focus can rest on with the Skill Tree open: a Skill, a Skill
 * Bar slot or the ×; for a learned Skill, the hit picking it up.
 */
export type SkillTreeFocusSpot = {
  rect: Rect;
  at: Vec;
  hit: SkillTreeHit | SkillBarHit;
  secondHit?: SkillTreeHit;
};

/**
 * The Skill Tree panel's Focus spots: each Skill's rows, clicked on its +,
 * which spends a point on it while one can be, else picks it up if learned,
 * the second face button always picking a learned one up; each Skill Bar
 * slot, to put a Held Skill in; and the ×.
 */
export function skillTreeFocusSpots(
  world: World,
  screen: Viewport,
): SkillTreeFocusSpot[] {
  const layout = skillTreePanelLayout(screen);
  const spots: SkillTreeFocusSpot[] = SKILLS.map((skill) => {
    const at = middleOf(layout.raise[skill]);
    const hit = skillTreeHitAt(screen, at, world, true) ?? { button: null };
    const learned = world.hero.progress.skillLevels[skill] > 0;
    const spot = { rect: layout.skills[skill], at, hit };
    if (!learned) return spot;
    return { ...spot, secondHit: { button: { type: "pickUpSkill", skill } } };
  });
  const { slots } = skillBarLayout(screen);
  for (const slot of SKILL_BAR_SLOTS) {
    const rect = slots[slot];
    const hit = { button: { type: "skillBarSlot", slot } } as const;
    spots.push({ rect, at: middleOf(rect), hit });
  }
  const { closeButton } = layout;
  const hit = { button: { type: "close", panel: "skillTree" } } as const;
  spots.push({ rect: closeButton, at: middleOf(closeButton), hit });
  return spots;
}
