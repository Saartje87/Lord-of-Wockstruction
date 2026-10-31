import { inside, middleOf, type Rect } from "../sim/rect";
import { SKILL_BAR_SLOTS } from "../sim/skillBar";
import { skillNumbers } from "../sim/skillNumbers";
import { synergyMultiplier } from "../sim/synergies";
import type { Vec } from "../sim/vec";
import {
  canRaiseSkill,
  type Skill,
  skillLevelOf,
  skillLevelsOf,
  type World,
} from "../sim/world";
import {
  BRANCH_GRID,
  BRANCHES,
  type Branch,
  branchSkills,
  branchTuning,
  type CastSkill,
  type GridPlace,
  isPassive,
  skillTuning,
} from "../tuning/skills";
import { atUiScale, type Viewport } from "../viewport";
import { type CloseButton, closeButtonRect, closeHitAt } from "./closeButton";
import { compactPanelRect } from "./compactLayout";
import { type SkillBarHit, skillBarLayout } from "./skillBar";

/**
 * The Skill Tree panel at the top right, where the Inventory panel goes
 * (CSS px at native scale, drawn at the UI Scale): `right` and `top` from the
 * screen's corner, `tabsTop` down to the Branch tabs, each `tabHeight` tall
 * and `tabGap` apart, `gridGap` under them the grid of Skill tiles, its
 * rows `rowPitch` apart, each tile `tile` square at most and each + at
 * most `plus` square on its corner, and `hintHeight` under the grid for the
 * hint. In the Compact Layout the grid shrinks to the room the screen leaves.
 */
export const SKILL_TREE_PANEL = {
  right: 16,
  top: 16,
  width: 320,
  padding: 18,
  tabsTop: 46,
  tabHeight: 30,
  tabGap: 6,
  gridGap: 10,
  rowPitch: 70,
  tile: 50,
  plus: 22,
  hintHeight: 28,
};

/** What the Skill Tree panel shows of a Skill, as text. */
export type SkillSheet = {
  skill: Skill;
  name: string;
  skillLevel: string;
  /** How many of those a Wand's Affix gives; empty for none. */
  raised: string;
  branch: Branch;
  /** Its place in its Branch's grid. */
  grid: GridPlace;
  /**
   * An arrow to each of its Prerequisites, lit once that Prerequisite has a
   * Skill Level learned.
   */
  arrows: readonly { from: Skill; lit: boolean }[];
  /**
   * The names of its Prerequisites the Hero has no Skill Level in, so no
   * Skill Point can go into this Skill yet; empty once all are learned.
   */
  prerequisites: readonly string[];
  /**
   * What a cast Skill does at its Skill Level (Skill Level 1's numbers while
   * it is unlearned), as "Label: text" lines with its Synergies and Passive
   * Skills counted; empty for a Passive Skill.
   */
  stats: readonly string[];
  /**
   * The same lines one Skill Level up: what a Skill Point buys. Only while one
   * can be spent on a learned Skill; empty otherwise.
   */
  nextStats: readonly string[];
  /**
   * Its Synergies: each giving Skill's name, percent per Skill Level and the
   * percent that giver adds now.
   */
  synergies: readonly {
    giver: string;
    percentPerSkillLevel: string;
    total: string;
  }[];
  /** The percent its Synergies add to its main number now. */
  synergyTotal: string;
  /**
   * What a Passive Skill gives, which has its own frame in the Skill Tree
   * and can't go on the Skill Bar; null for a Skill that is cast.
   */
  passive: {
    percentPerSkillLevel: string;
    /** The percent it adds now. */
    total: string;
    /** The names of the Skills it boosts, comma separated. */
    boosts: string;
  } | null;
  /** The Level the Hero must reach to spend a Skill Point on it, until then. */
  requiredLevel: string | null;
  /** Whether a Skill Point can be spent on it now, so its + shows. */
  canRaise: boolean;
};

/** What the Skill Tree panel shows of the Hero, as text. */
export type SkillTreeSheet = {
  skillPoints: string;
  /** The Skills grouped by Branch, each Branch by grid place. */
  skills: SkillSheet[];
  /**
   * The Branches' names, in the order the Skills are grouped, with the Skill
   * Points spent in each, for its Branch tab.
   */
  branches: { branch: Branch; name: string; spent: string }[];
};

/** What the Skill Tree panel shows, from the Hero's progress. */
export function skillTreeSheet(world: World): SkillTreeSheet {
  const { progress } = world.hero;
  // Everything the sheet shows reads the Skill Level, a Wand's raise
  // included; only a Prerequisite (to spend a point) reads the learned one.
  const levels = skillLevelsOf(world);
  return {
    skillPoints: String(progress.skillPoints),
    branches: BRANCHES.map((branch) => ({
      branch,
      name: branchTuning[branch].name,
      spent: String(
        branchSkills[branch].reduce(
          (sum, skill) => sum + progress.skillLevels[skill],
          0,
        ),
      ),
    })),
    skills: BRANCHES.flatMap((branch) => branchSkills[branch]).map((skill) => {
      const skillLevel = levels[skill];
      const raised = skillLevel - progress.skillLevels[skill];
      const { requiredLevel, prerequisites } = skillTuning[skill];
      const { passive } = skillTuning[skill];
      const canRaise = canRaiseSkill(world, skill);
      const statsAt = (at: number): string[] =>
        isPassive(skill)
          ? []
          : skillNumbers(skill as CastSkill, at, levels).map(
              ({ label, text }) => `${label}: ${text}`,
            );
      return {
        skill,
        name: skillTuning[skill].name,
        branch: skillTuning[skill].branch,
        grid: skillTuning[skill].grid,
        arrows: prerequisites.map((from) => ({
          from,
          lit: progress.skillLevels[from] > 0,
        })),
        prerequisites: prerequisites
          .filter((before) => progress.skillLevels[before] === 0)
          .map((before) => skillTuning[before].name),
        skillLevel: String(skillLevel),
        raised: raised > 0 ? String(raised) : "",
        synergies: skillTuning[skill].synergies.map((synergy) => ({
          giver: skillTuning[synergy.skill].name,
          percentPerSkillLevel: String(synergy.percentPerSkillLevel),
          total: String(synergy.percentPerSkillLevel * levels[synergy.skill]),
        })),
        synergyTotal: String(
          Math.round((synergyMultiplier(levels, skill) - 1) * 100),
        ),
        passive: passive
          ? {
              percentPerSkillLevel: String(passive.percentPerSkillLevel),
              total: String(passive.percentPerSkillLevel * skillLevel),
              boosts: passive.boosts
                .map((boosted) => skillTuning[boosted].name)
                .join(", "),
            }
          : null,
        requiredLevel:
          progress.level < requiredLevel ? String(requiredLevel) : null,
        canRaise,
        stats: statsAt(Math.max(skillLevel, 1)),
        nextStats: canRaise && skillLevel > 0 ? statsAt(skillLevel + 1) : [],
      };
    }),
  };
}

/** The Skill Tree panel's parts, laid out for one open Branch. */
export type SkillTreeLayout = {
  panel: Rect;
  closeButton: Rect;
  /** Where the unspent Skill Points are written, right-aligned, left of the ×. */
  points: Rect;
  /** A tab for each Branch, over the grid. */
  tabs: Record<Branch, Rect>;
  /** The open Branch's Skills: each one's tile and its + on the tile's corner. */
  skills: { skill: Skill; tile: Rect; raise: Rect }[];
  /** A line from each Prerequisite down to the Skill hanging from it. */
  arrows: { from: Skill; to: Skill; points: Vec[] }[];
};

/**
 * Where the panel itself is drawn: at the top right, as tall as its grid
 * wants, or in the Compact Layout filling the screen.
 */
export function skillTreePanelRect(screen: Viewport): Rect {
  if (screen.compact) return compactPanelRect(screen);
  const size = atUiScale(SKILL_TREE_PANEL, screen.uiScale);
  return {
    x: screen.width - size.right - size.width,
    y: size.top,
    w: size.width,
    h:
      size.tabsTop +
      size.tabHeight +
      size.gridGap +
      BRANCH_GRID.rows * size.rowPitch +
      size.hintHeight +
      size.padding,
  };
}

/**
 * Where the panel, its × close button, the Branch tabs and, for the open
 * Branch `branch`, each Skill's tile, its + and the arrows to its
 * Prerequisites are drawn. The grid is 3 columns by 6 rows; on a short
 * screen its rows squeeze to what fits.
 */
export function skillTreePanelLayout(
  screen: Viewport,
  branch: Branch = "bone",
): SkillTreeLayout {
  const size = atUiScale(SKILL_TREE_PANEL, screen.uiScale);
  const panel = skillTreePanelRect(screen);
  const closeButton = closeButtonRect(panel, screen.uiScale);
  const pointsWidth = 110 * screen.uiScale;
  const points = {
    x: closeButton.x - 8 * screen.uiScale - pointsWidth,
    y: closeButton.y,
    w: pointsWidth,
    h: closeButton.h,
  };
  // The Compact Layout is wide and short: the tabs go on the title's line,
  // between the title and the Skill Points, leaving the height to the grid.
  const tabsY = screen.compact
    ? closeButton.y + (closeButton.h - size.tabHeight) / 2
    : panel.y + size.tabsTop;
  const gridTop = screen.compact
    ? tabsY + size.tabHeight + size.tabGap
    : tabsY + size.tabHeight + size.gridGap;
  const gridBottom = panel.y + panel.h - size.hintHeight - size.padding;
  const pitchY = Math.min(
    size.rowPitch,
    (gridBottom - gridTop) / BRANCH_GRID.rows,
  );
  const pitchX = Math.min(
    (panel.w - 2 * size.padding) / BRANCH_GRID.columns,
    pitchY * 1.7,
  );
  const gridWidth = pitchX * BRANCH_GRID.columns;
  const gridLeft = panel.x + (panel.w - gridWidth) / 2;
  const tile = Math.min(size.tile, pitchY * 0.74, pitchX * 0.7);
  const plus = Math.min(size.plus, tile * 0.45);

  const tabsLeft = screen.compact
    ? panel.x + size.padding + 115 * screen.uiScale
    : gridLeft;
  const tabsWidth = screen.compact
    ? points.x - 8 * screen.uiScale - tabsLeft
    : gridWidth;
  const tabWidth = Math.min(
    (tabsWidth - (BRANCHES.length - 1) * size.tabGap) / 3,
    screen.compact ? 100 * screen.uiScale : Infinity,
  );
  const tabs = Object.fromEntries(
    BRANCHES.map((other, index) => [
      other,
      {
        x: tabsLeft + index * (tabWidth + size.tabGap),
        y: tabsY,
        w: tabWidth,
        h: size.tabHeight,
      },
    ]),
  ) as Record<Branch, Rect>;

  const tileAt = ({ column, row }: GridPlace): Rect => ({
    x: gridLeft + column * pitchX + (pitchX - tile) / 2,
    y: gridTop + row * pitchY + (pitchY - tile) / 2,
    w: tile,
    h: tile,
  });
  const skills = branchSkills[branch].map((skill) => {
    const rect = tileAt(skillTuning[skill].grid);
    return {
      skill,
      tile: rect,
      raise: { x: rect.x + rect.w - plus, y: rect.y, w: plus, h: plus },
    };
  });
  const tileOf = (skill: Skill) =>
    skills.find((shown) => shown.skill === skill)?.tile as Rect;
  const gap = (pitchY - tile) / 2;
  const arrows = skills.flatMap(({ skill, tile: to }) =>
    skillTuning[skill].prerequisites.map((from) => {
      const start = tileOf(from);
      const top = { x: to.x + to.w / 2, y: to.y };
      const bottom = { x: start.x + start.w / 2, y: start.y + start.h };
      const bend = top.y - gap;
      return {
        from,
        to: skill,
        points:
          bottom.x === top.x
            ? [bottom, top]
            : [bottom, { x: bottom.x, y: bend }, { x: top.x, y: bend }, top],
      };
    }),
  );
  return {
    panel,
    closeButton,
    points,
    tabs,
    skills,
    arrows,
  };
}

/**
 * A click on the open Skill Tree panel, so not for the World: the ×, a
 * Branch tab, the Skill whose + it pressed, the learned Skill it picked up
 * to drag onto the Skill Bar, or null elsewhere.
 */
export type SkillTreeHit = {
  button:
    | { type: "branchTab"; branch: Branch }
    | { type: "learn"; skill: Skill }
    | { type: "pickUpSkill"; skill: Skill }
    | CloseButton
    | null;
};

/**
 * What a click at `point` hits of the Skill Tree panel with `branch` open,
 * or null when it's off it or the panel isn't `open`, so it's for the
 * World. A Skill's + button is there only while a Skill Point can be spent
 * on it; the rest of a learned Skill's tile picks it up.
 */
export function skillTreeHitAt(
  screen: Viewport,
  point: Vec,
  world: World,
  open: boolean,
  branch: Branch = "bone",
): SkillTreeHit | null {
  const layout = skillTreePanelLayout(screen, branch);
  if (!open || !inside(layout.panel, point)) return null;
  const closeHit = closeHitAt(layout, point, "skillTree");
  if (closeHit) return closeHit;
  for (const other of BRANCHES) {
    if (inside(layout.tabs[other], point)) {
      return { button: { type: "branchTab", branch: other } };
    }
  }
  for (const { skill, tile, raise } of layout.skills) {
    if (canRaiseSkill(world, skill) && inside(raise, point)) {
      return { button: { type: "learn", skill } };
    }
    const learned = skillLevelOf(world, skill) > 0;
    // A Passive Skill is never put on the Skill Bar, so there's nothing to lift.
    if (learned && !isPassive(skill) && inside(tile, point)) {
      return { button: { type: "pickUpSkill", skill } };
    }
  }
  return { button: null };
}

/**
 * A spot the Focus can rest on with the Skill Tree open: a Branch tab, a
 * Skill, a Skill Bar slot or the ×; for a learned Skill, the hit picking it
 * up.
 */
export type SkillTreeFocusSpot = {
  rect: Rect;
  at: Vec;
  hit: SkillTreeHit | SkillBarHit;
  secondHit?: SkillTreeHit;
};

/**
 * The Skill Tree panel's Focus spots with `branch` open: each Branch tab;
 * each Skill's tile, clicked on its +, which spends a point on it while one
 * can be, else picks it up if learned, the second face button always
 * picking a learned one up; each Skill Bar slot, to put a Held Skill in;
 * and the ×.
 */
export function skillTreeFocusSpots(
  world: World,
  screen: Viewport,
  branch: Branch = "bone",
): SkillTreeFocusSpot[] {
  const layout = skillTreePanelLayout(screen, branch);
  const spots: SkillTreeFocusSpot[] = BRANCHES.map((other) => ({
    rect: layout.tabs[other],
    at: middleOf(layout.tabs[other]),
    hit: { button: { type: "branchTab", branch: other } },
  }));
  for (const { skill, tile, raise } of layout.skills) {
    const at = middleOf(raise);
    const hit = skillTreeHitAt(screen, at, world, true, branch) ?? {
      button: null,
    };
    const learned = skillLevelOf(world, skill) > 0;
    const spot = { rect: tile, at, hit };
    spots.push(
      !learned || isPassive(skill)
        ? spot
        : { ...spot, secondHit: { button: { type: "pickUpSkill", skill } } },
    );
  }
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
