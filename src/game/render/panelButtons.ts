import type { Panel } from "../menus";
import { inside, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import { BELT_STRIP } from "./beltStrip";
import { SKILL_BAR, skillBarLayout } from "./skillBar";

/** The Panel buttons from left to right. */
export const PANEL_BUTTONS: readonly Panel[] = [
  "hero",
  "inventory",
  "skillTree",
];

/**
 * Where each Panel button is drawn: as big and as far apart as the Skill
 * Bar's slots, in line with them, starting as far right of the Skill Bar as
 * the Belt strip ends left of it.
 */
export function panelButtonsLayout(screen: { width: number; height: number }): {
  buttons: Record<Panel, Rect>;
} {
  const { slot, gap } = SKILL_BAR;
  const { right } = skillBarLayout(screen).slots;
  const left = right.x + right.w + BELT_STRIP.toSkillBar;
  return {
    buttons: Object.fromEntries(
      PANEL_BUTTONS.map((panel, index) => [
        panel,
        { x: left + index * (slot + gap), y: right.y, w: slot, h: slot },
      ]),
    ) as Record<Panel, Rect>,
  };
}

/** A Panel button, which opens or shuts its panel as its key does. */
export type PanelButton = { type: "panelButton"; panel: Panel };

/** A click on a Panel button, so not for the World. */
export type PanelButtonHit = { button: PanelButton };

/** What a click at `point` hits of the Panel buttons, or null off them. */
export function panelButtonHitAt(
  screen: { width: number; height: number },
  point: Vec,
): PanelButtonHit | null {
  const { buttons } = panelButtonsLayout(screen);
  const panel = PANEL_BUTTONS.find((name) => inside(buttons[name], point));
  return panel ? { button: { type: "panelButton", panel } } : null;
}
