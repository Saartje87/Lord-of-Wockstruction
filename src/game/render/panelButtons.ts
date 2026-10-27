import type { CursorHit } from "../cursor";
import {
  type HeroState,
  type Menus,
  PANEL_KEYS,
  PANELS,
  type Panel,
  panelOpen,
} from "../menus";
import { inside, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import { atUiScale, type Viewport } from "../viewport";
import { COMPACT_LAYOUT } from "./compactLayout";
import { BELT_STRIP, SKILL_BAR, skillBarLayout } from "./skillBar";
import { tooltipRect } from "./tooltip";

/**
 * Where each Panel button is drawn: as big and as far apart as the Skill
 * Bar's slots, in line with them, starting as far right of the Skill Bar as
 * the Belt strip ends left of it. In the Compact Layout, where the bottom
 * has no room for them, they stack down the screen's top-right corner
 * instead, `margin` in, clear of the panels.
 */
export function panelButtonsLayout(screen: Viewport): {
  buttons: Record<Panel, Rect>;
} {
  const { slot, gap } = atUiScale(SKILL_BAR, screen.uiScale);
  if (screen.compact) {
    const { margin } = atUiScale(COMPACT_LAYOUT, screen.uiScale);
    const x = screen.width - margin - slot;
    return {
      buttons: Object.fromEntries(
        PANELS.map((panel, index) => [
          panel,
          { x, y: margin + index * (slot + gap), w: slot, h: slot },
        ]),
      ) as Record<Panel, Rect>,
    };
  }
  const { right } = skillBarLayout(screen).slots;
  const { toSkillBar } = atUiScale(BELT_STRIP, screen.uiScale);
  const left = right.x + right.w + toSkillBar;
  return {
    buttons: Object.fromEntries(
      PANELS.map((panel, index) => [
        panel,
        { x: left + index * (slot + gap), y: right.y, w: slot, h: slot },
      ]),
    ) as Record<Panel, Rect>,
  };
}

/**
 * Where the tooltip of `panel`'s Panel button goes, `size` big and `gap`
 * from what it's over: over the button on the HUD. In the Compact Layout,
 * where the buttons stack down the top-right corner with the open panel's ×
 * beside the top one, under the whole stack, clear of them all.
 */
export function panelButtonTooltipRect(
  screen: Viewport,
  panel: Panel,
  size: { w: number; h: number },
  gap: number,
): Rect {
  const { buttons } = panelButtonsLayout(screen);
  if (!screen.compact) return tooltipRect(buttons[panel], size, screen, gap);
  const top = buttons[PANELS[0]];
  const bottom = buttons[PANELS[PANELS.length - 1]];
  const stack = { ...top, h: bottom.y + bottom.h - top.y };
  return {
    ...tooltipRect(stack, size, screen, gap),
    y: stack.y + stack.h + gap,
  };
}

/** A Panel button, which opens or shuts its panel as its key does. */
export type PanelButton = { type: "panelButton"; panel: Panel };

/** A click on a Panel button, so not for the World. */
export type PanelButtonHit = { button: PanelButton };

/** What a click at `point` hits of the Panel buttons, or null off them. */
export function panelButtonHitAt(
  screen: Viewport,
  point: Vec,
): PanelButtonHit | null {
  const { buttons } = panelButtonsLayout(screen);
  const panel = PANELS.find((name) => inside(buttons[name], point));
  return panel ? { button: { type: "panelButton", panel } } : null;
}

/**
 * What a Panel button shows: its panel, lit while that panel is open
 * however it was opened, dimmed while the Hero lies in Death, and the
 * tooltip naming it and its key while hovered.
 */
export type PanelButtonSheet = {
  panel: Panel;
  lit: boolean;
  dimmed: boolean;
  tooltip: string;
};

/** Each panel's name, as its Panel button's tooltip gives it. */
const PANEL_NAMES: Record<Panel, string> = {
  hero: "Hero",
  inventory: "Inventory",
  skillTree: "Skill Tree",
};

/** What the Panel buttons show, from left to right. */
export function panelButtonsSheet(
  menus: Menus,
  hero: HeroState,
): PanelButtonSheet[] {
  return PANELS.map((panel) => ({
    panel,
    lit: panelOpen(menus, panel),
    dimmed: hero.heroDead,
    tooltip: `${PANEL_NAMES[panel]} (${PANEL_KEYS[panel].toUpperCase()})`,
  }));
}

/** The Panel button `hit` is on, as the renderer's `panelAt` hands it back, or null. */
export function hoveredPanelButton(hit: CursorHit | null): Panel | null {
  if (!hit || !("button" in hit)) return null;
  return hit.button?.type === "panelButton" ? hit.button.panel : null;
}
