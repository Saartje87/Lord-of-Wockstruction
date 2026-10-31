import { inside, middleOf, type Rect } from "../sim/rect";
import { SKILL_BAR_SLOTS } from "../sim/skillBar";
import { synergyMultiplier } from "../sim/synergies";
import type { Vec } from "../sim/vec";
import {
  canRaiseSkill,
  type Skill,
  skillLevelOf,
  skillLevelsOf,
  skillManaCost,
  type World,
} from "../sim/world";
import {
  BRANCHES,
  type Branch,
  branchSkills,
  branchTuning,
  isPassive,
  skillTuning,
} from "../tuning/skills";
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
  rowHeight: 24,
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
 * The rows of the panel under its title: the unspent Skill Points, then
 * the Branches, each a heading row (its name, and over the Skills' columns
 * theirs) with a row for each of its Skills under it. In the Compact Layout
 * the Branches stand side by side instead, `gap` apart (CSS px at native
 * scale, drawn at the UI Scale), with Skill Level and + the only columns.
 */
export const SKILL_TREE_ROWS = { skillPoints: 0, firstBranch: 1 } as const;

/** The space between Branch columns in the Compact Layout, and its column. */
export const SKILL_TREE_COMPACT = { gap: 10, skillLevel: 30 };

/** How many Skills each Branch's rows make room for. */
export type BranchRooms = Record<Branch, number>;

/** The rooms the Skills in tuning take. */
export function tunedRooms(): BranchRooms {
  return Object.fromEntries(
    BRANCHES.map((branch) => [branch, branchSkills[branch].length]),
  ) as BranchRooms;
}

/** The rooms the Skill Tree is built to hold: Bone 6, Summoning 4, Curses 5. */
export function fullRooms(): BranchRooms {
  return Object.fromEntries(
    BRANCHES.map((branch) => [branch, branchTuning[branch].room]),
  ) as BranchRooms;
}

/** What the Skill Tree panel shows of a Skill, as text. */
export type SkillSheet = {
  skill: Skill;
  name: string;
  skillLevel: string;
  /** How many of those a Wand's Affix gives; empty for none. */
  raised: string;
  branch: Branch;
  /**
   * The name of its Prerequisite while the Hero has no Skill Level in it,
   * so no Skill Point can go into this Skill yet; else null.
   */
  prerequisite: string | null;
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
  /** What a cast costs at the next Skill Level: what a + buys; empty for a Passive Skill. */
  manaCost: string;
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
  /** The Skills grouped by Branch, each Branch in Prerequisite order. */
  skills: SkillSheet[];
  /** The Branches' names, in the order the Skills are grouped. */
  branches: { branch: Branch; name: string }[];
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
    })),
    skills: BRANCHES.flatMap((branch) => branchSkills[branch]).map((skill) => {
      const skillLevel = levels[skill];
      const raised = skillLevel - progress.skillLevels[skill];
      const { requiredLevel, prerequisite } = skillTuning[skill];
      const { passive } = skillTuning[skill];
      return {
        skill,
        name: skillTuning[skill].name,
        branch: skillTuning[skill].branch,
        prerequisite:
          prerequisite && progress.skillLevels[prerequisite] === 0
            ? skillTuning[prerequisite].name
            : null,
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
        manaCost: isPassive(skill)
          ? ""
          : String(skillManaCost(skill, skillLevel + 1)),
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
 * for Branches of `rooms` Skills, or in the Compact Layout filling the
 * screen.
 */
export function skillTreePanelRect(
  screen: Viewport,
  rooms: BranchRooms = tunedRooms(),
): Rect {
  if (screen.compact) return compactPanelRect(screen);
  const { right, top, width, padding, firstRow, rowHeight, hintHeight } =
    atUiScale(SKILL_TREE_PANEL, screen.uiScale);
  const rows = BRANCHES.reduce<number>(
    (sum, branch) => sum + 1 + rooms[branch],
    SKILL_TREE_ROWS.firstBranch,
  );
  return {
    x: screen.width - right - width,
    y: top,
    w: width,
    h: firstRow + rows * rowHeight + hintHeight + padding,
  };
}

/** Where the heading row of Branch `branch` is drawn (CSS px). */
export function skillTreeBranchRow(
  screen: Viewport,
  branch: Branch,
  rooms: BranchRooms = tunedRooms(),
): Rect {
  const { rowHeight, padding, firstRow } = atUiScale(
    SKILL_TREE_PANEL,
    screen.uiScale,
  );
  const index = BRANCHES.indexOf(branch);
  if (screen.compact) {
    const panel = skillTreePanelRect(screen, rooms);
    const gap = SKILL_TREE_COMPACT.gap * screen.uiScale;
    const w = (panel.w - 2 * padding - (BRANCHES.length - 1) * gap) / 3;
    return {
      x: panel.x + padding + index * (w + gap),
      y: panel.y + firstRow + SKILL_TREE_ROWS.firstBranch * rowHeight,
      w,
      h: rowHeight,
    };
  }
  const before = BRANCHES.slice(0, index).reduce(
    (sum, other) => sum + 1 + rooms[other],
    0,
  );
  return skillTreeRow(screen, SKILL_TREE_ROWS.firstBranch + before);
}

/** Where the `index`th Skill of Branch `branch` has its row (CSS px). */
export function skillTreeSkillRow(
  screen: Viewport,
  branch: Branch,
  index: number,
  rooms: BranchRooms = tunedRooms(),
): Rect {
  const heading = skillTreeBranchRow(screen, branch, rooms);
  return { ...heading, y: heading.y + (1 + index) * heading.h };
}

/**
 * Where a Skill's row puts its columns (CSS px), at the UI Scale: the x its
 * required Level starts at, and the x its Skill Level and its Mana cost end
 * at. The headings over them line up the same way. In the Compact Layout's
 * narrow columns only the Skill Level is kept, clear of the +; the others
 * sit on it, unshown.
 */
export function skillTreeColumns(
  screen: Viewport,
  row: Rect,
): { requiredLevel: number; skillLevel: number; manaCost: number } {
  const right = row.x + row.w;
  if (screen.compact) {
    const skillLevel = right - SKILL_TREE_COMPACT.skillLevel * screen.uiScale;
    return { requiredLevel: skillLevel, skillLevel, manaCost: skillLevel };
  }
  const at = atUiScale(SKILL_TREE_COLUMNS, screen.uiScale);
  return {
    requiredLevel: right - at.requiredLevel,
    skillLevel: right - at.skillLevel,
    manaCost: right - at.manaCost,
  };
}

/**
 * Where the panel and its × close button are drawn, each Skill's row (where
 * pressing a learned Skill picks it up to drag onto the Skill Bar) and each
 * Skill's + button.
 */
export function skillTreePanelLayout(
  screen: Viewport,
  rooms: BranchRooms = tunedRooms(),
): {
  panel: Rect;
  closeButton: Rect;
  branches: Record<Branch, Rect>;
  skills: Record<Skill, Rect>;
  raise: Record<Skill, Rect>;
} {
  const { rowHeight, plus } = atUiScale(SKILL_TREE_PANEL, screen.uiScale);
  const panel = skillTreePanelRect(screen, rooms);
  const rows = BRANCHES.flatMap((branch) =>
    branchSkills[branch].map(
      (skill, index) =>
        [skill, skillTreeSkillRow(screen, branch, index, rooms)] as const,
    ),
  );
  const skills = Object.fromEntries(rows) as Record<Skill, Rect>;
  const plusAt = (skill: Skill): Rect => {
    const at = skills[skill];
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
    branches: Object.fromEntries(
      BRANCHES.map((branch) => [
        branch,
        skillTreeBranchRow(screen, branch, rooms),
      ]),
    ) as Record<Branch, Rect>,
    skills,
    raise: Object.fromEntries(
      rows.map(([skill]) => [skill, plusAt(skill)]),
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
  for (const skill of BRANCHES.flatMap((branch) => branchSkills[branch])) {
    if (canRaiseSkill(world, skill) && inside(layout.raise[skill], point)) {
      return { button: { type: "learn", skill } };
    }
    const learned = skillLevelOf(world, skill) > 0;
    // A Passive Skill is never put on the Skill Bar, so there's nothing to lift.
    if (learned && !isPassive(skill) && inside(layout.skills[skill], point)) {
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
  // Top to bottom, Branch by Branch, so the Focus starts at the first.
  const spots: SkillTreeFocusSpot[] = BRANCHES.flatMap(
    (branch) => branchSkills[branch],
  ).map((skill) => {
    const at = middleOf(layout.raise[skill]);
    const hit = skillTreeHitAt(screen, at, world, true) ?? { button: null };
    const learned = skillLevelOf(world, skill) > 0;
    const spot = { rect: layout.skills[skill], at, hit };
    if (!learned || isPassive(skill)) return spot;
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
