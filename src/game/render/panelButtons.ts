import type { CursorHit } from "../cursor";
import type { InputWay } from "../input/activeInput";
import {
  type HeroPoints,
  type HeroState,
  type Menus,
  PANEL_KEYS,
  PANELS,
  type Panel,
  panelOpen,
  unplacedPoints,
} from "../menus";
import { inside, middleOf, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import { atUiScale, type Viewport } from "../viewport";
import { COMPACT_LAYOUT } from "./compactLayout";
import { townPortalTooltip } from "./hints";
import { orbsLayout } from "./orbs";
import { BELT_STRIP, SKILL_BAR, skillBarLayout } from "./skillBar";
import { tooltipRect } from "./tooltip";

/**
 * The Town Portal button (CSS px at native scale, drawn at the UI Scale):
 * round, `size` across, a little smaller than a Panel button so that it
 * fits before the Mana orb on a 4:3 screen too.
 */
export const TOWN_PORTAL_BUTTON = { size: 36 };

/**
 * The right edge of what sits in the top right corner (the Mini Map, the Map
 * Overlay's Area name): the screen's, or in the Compact Layout, where the
 * Panel buttons stack down that corner, the left of their column.
 */
export function topRightEdge(screen: Viewport): number {
  return screen.compact
    ? panelButtonsLayout(screen).buttons.hero.x
    : screen.width;
}

/**
 * Where each Panel button is drawn, and the Town Portal button after them:
 * as big and as far apart as the Skill Bar's slots, in line with them,
 * starting as far right of the Skill Bar as the Belt strip ends left of it.
 * In the Compact Layout, where the bottom has no room for them, they stack
 * down the screen's top-right corner instead, `margin` in, clear of the
 * panels. The Town Portal button is centred on the slot it would take, or,
 * where that would reach the Mana orb, sits above the last Panel button.
 */
export function panelButtonsLayout(screen: Viewport): {
  buttons: Record<Panel, Rect>;
  townPortal: Rect;
} {
  const { slot, gap } = atUiScale(SKILL_BAR, screen.uiScale);
  let at: (index: number) => Rect;
  if (screen.compact) {
    const { margin } = atUiScale(COMPACT_LAYOUT, screen.uiScale);
    const x = screen.width - margin - slot;
    at = (index) => ({ x, y: margin + index * (slot + gap), w: slot, h: slot });
  } else {
    const { right } = skillBarLayout(screen).slots;
    const { toSkillBar } = atUiScale(BELT_STRIP, screen.uiScale);
    const left = right.x + right.w + toSkillBar;
    at = (index) => ({
      x: left + index * (slot + gap),
      y: right.y,
      w: slot,
      h: slot,
    });
  }
  const { size } = atUiScale(TOWN_PORTAL_BUTTON, screen.uiScale);
  // After the last Panel button by the same gap, centred across the column
  // or on the row; on a screen too narrow for the row to clear the Mana orb,
  // above the last Panel button instead.
  const after = at(PANELS.length);
  const last = at(PANELS.length - 1);
  const orb = orbsLayout(screen).mana;
  const fitsRow = after.x + size < orb.x - orb.radius - orb.rim;
  let townPortal: Rect;
  if (screen.compact) {
    townPortal = {
      x: after.x + (slot - size) / 2,
      y: after.y,
      w: size,
      h: size,
    };
  } else if (fitsRow) {
    townPortal = {
      x: after.x,
      y: after.y + (slot - size) / 2,
      w: size,
      h: size,
    };
  } else {
    townPortal = {
      x: last.x + (slot - size) / 2,
      y: last.y - gap - size,
      w: size,
      h: size,
    };
  }
  return {
    buttons: Object.fromEntries(
      PANELS.map((panel, index) => [panel, at(index)]),
    ) as Record<Panel, Rect>,
    townPortal,
  };
}

/**
 * Where the tooltip of `button`, a Panel button or the Town Portal button,
 * goes, `size` big and `gap` from what it's over: over the button on the
 * HUD. In the Compact Layout, where the buttons stack down the top-right
 * corner with the open panel's × beside the top one, under the whole stack,
 * clear of them all.
 */
export function panelButtonTooltipRect(
  screen: Viewport,
  button: Panel | "townPortal",
  size: { w: number; h: number },
  gap: number,
): Rect {
  const { buttons, townPortal } = panelButtonsLayout(screen);
  if (!screen.compact) {
    const over = button === "townPortal" ? townPortal : buttons[button];
    return tooltipRect(over, size, screen, gap);
  }
  const top = buttons[PANELS[0]];
  const stack = { ...top, h: townPortal.y + townPortal.h - top.y };
  return {
    ...tooltipRect(stack, size, screen, gap),
    y: stack.y + stack.h + gap,
  };
}

/**
 * Where the panels at the right of a desktop screen must stop (the bottom
 * edge, in CSS px): above the Panel buttons (the Hero button's top, as they
 * are in line), the Town Portal button and the Mana orb, whichever reaches
 * highest.
 */
export function rightPanelsBottom(screen: Viewport): number {
  const { buttons, townPortal } = panelButtonsLayout(screen);
  const { mana } = orbsLayout(screen);
  return Math.min(
    buttons.hero.y,
    townPortal.y,
    mana.y - mana.radius - mana.rim,
  );
}

/** A Panel button, which opens or shuts its panel as its key does. */
export type PanelButton = { type: "panelButton"; panel: Panel };

/** The Town Portal button, which opens a Town Portal as its key does. */
export type TownPortalButton = { type: "townPortal" };

/** A click on a Panel button or the Town Portal button, so not for the World. */
export type PanelButtonHit = { button: PanelButton | TownPortalButton };

/**
 * What a click at `point` hits of the Panel buttons and the Town Portal
 * button, the latter only inside its circle, or null off them.
 */
export function panelButtonHitAt(
  screen: Viewport,
  point: Vec,
): PanelButtonHit | null {
  const { buttons, townPortal } = panelButtonsLayout(screen);
  const panel = PANELS.find((name) => inside(buttons[name], point));
  if (panel) return { button: { type: "panelButton", panel } };
  const radius = townPortal.w / 2;
  const { x, y } = middleOf(townPortal);
  if (Math.hypot(point.x - x, point.y - y) <= radius) {
    return { button: { type: "townPortal" } };
  }
  return null;
}

/**
 * What a Panel button shows: its panel, lit while that panel is open
 * however it was opened, dimmed while the Hero lies in Death, `points` while
 * it has a Points mark (lit or not), and the tooltip naming it and its key,
 * and the points left to spend whenever `points`.
 */
export type PanelButtonSheet = {
  panel: Panel;
  lit: boolean;
  dimmed: boolean;
  points: boolean;
  tooltip: string;
};

/** Each panel's name, as its Panel button's tooltip gives it. */
const PANEL_NAMES: Record<Panel, string> = {
  hero: "Hero",
  inventory: "Inventory",
  skillTree: "Skill Tree",
  quest: "Quests",
};

/** The points a panel is spent from, as its tooltip names them. */
const POINTS_KINDS: Partial<Record<Panel, "Attribute" | "Skill">> = {
  hero: "Attribute",
  skillTree: "Skill",
};

/**
 * The points left to spend on `panel`, with their kind, or null where it
 * has none to spend: the Hero panel's unspent Attribute Points, less those
 * already placed as Pending, and the Skill Tree's unspent Skill Points.
 */
function pointsToSpend(
  menus: Menus,
  hero: HeroPoints,
  panel: Panel,
): { count: number; kind: "Attribute" | "Skill" } | null {
  const kind = POINTS_KINDS[panel];
  if (!kind) return null;
  const count =
    kind === "Attribute"
      ? unplacedPoints(menus, hero.attributePoints)
      : hero.skillPoints;
  return count > 0 ? { count, kind } : null;
}

/** "5 Attribute Points to spend", or "1 Skill Point to spend". */
function pointsTooltip({ count, kind }: { count: number; kind: string }) {
  return `${count} ${kind} Point${count === 1 ? "" : "s"} to spend`;
}

/**
 * What the Panel buttons show, from left to right. The Hero button's Points
 * mark counts the Attribute Points not yet placed as Pending, the Skill Tree
 * button's the Skill Points `hero` has unspent.
 */
export function panelButtonsSheet(
  menus: Menus,
  hero: HeroPoints,
): PanelButtonSheet[] {
  return PANELS.map((panel) => {
    const toSpend = pointsToSpend(menus, hero, panel);
    const key = `${PANEL_NAMES[panel]} (${PANEL_KEYS[panel].toUpperCase()})`;
    return {
      panel,
      lit: panelOpen(menus, panel),
      dimmed: hero.heroDead,
      points: toSpend !== null,
      tooltip: toSpend ? `${key} \u00b7 ${pointsTooltip(toSpend)}` : key,
    };
  });
}

/**
 * What the Town Portal button shows: greyed out in Town, where no Town
 * Portal opens, and while the Hero lies in Death, as the Panel buttons
 * dim; and the tooltip naming it and its key or button with `way`.
 */
export type TownPortalButtonSheet = { greyed: boolean; tooltip: string };

/** What the Town Portal button shows, as `TownPortalButtonSheet` says. */
export function townPortalButtonSheet(
  hero: HeroState & { inTown: boolean },
  way: InputWay,
): TownPortalButtonSheet {
  return {
    greyed: hero.heroDead || hero.inTown,
    tooltip: townPortalTooltip(way),
  };
}

/**
 * The Panel button `hit` is on, or "townPortal" on the Town Portal button,
 * as the renderer's `panelAt` hands it back, or null.
 */
export function hoveredPanelButton(
  hit: CursorHit | null,
): Panel | "townPortal" | null {
  if (!hit || !("button" in hit)) return null;
  if (hit.button?.type === "townPortal") return "townPortal";
  return hit.button?.type === "panelButton" ? hit.button.panel : null;
}
