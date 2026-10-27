import type { Rect } from "../sim/rect";
import type { Viewport } from "../viewport";
import { SKILL_BAR, skillBarLayout } from "./skillBar";

/**
 * The Compact Layout's spacing (CSS px at native scale, drawn at the UI
 * Scale): the open panel and the Panel buttons keep `margin` from the
 * screen's edges, from each other and from the Skill Bar.
 */
export const COMPACT_LAYOUT = { margin: 8 };

/**
 * Where the one open panel goes in the Compact Layout: filling the screen
 * inside the margin, but for the Panel buttons' column down its right and
 * the Skill Bar's row along its bottom, so they stay in reach to switch
 * panels and to put a Held Skill on the Skill Bar. It covers the orbs.
 */
export function compactPanelRect(screen: Viewport): Rect {
  const margin = COMPACT_LAYOUT.margin * screen.uiScale;
  const buttonsLeft = screen.width - margin - SKILL_BAR.slot * screen.uiScale;
  const { key1 } = skillBarLayout(screen).slots;
  return {
    x: margin,
    y: margin,
    w: buttonsLeft - 2 * margin,
    h: key1.y - 2 * margin,
  };
}
