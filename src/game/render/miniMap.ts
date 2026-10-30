import { anyPanelOpen, type Menus } from "../menus";
import { inside, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import { atUiScale, type Viewport } from "../viewport";
import { topRightEdge } from "./panelButtons";
import { tooltipRect } from "./tooltip";

/**
 * How the Mini Map is drawn (CSS px at native scale, drawn at the UI Scale):
 * `size` square, `margin` from the screen's top right, in a flat bronze
 * frame `frame` thick with gold studs `stud` across at its corners, over a
 * dark fill. The map shows through at `opacity`, and a tile takes `scale` of
 * the World's size at the UI Scale.
 */
export const MINI_MAP = {
  size: 176,
  compactSize: 96,
  margin: 12,
  frame: 2,
  frameColour: 0x8a6d3b,
  stud: 5,
  studColour: 0xc9a45a,
  fill: 0x000000,
  fillAlpha: 0.45,
  opacity: 0.85,
  scale: 0.14,
};

/**
 * Where the Mini Map is drawn: square at the screen's top right. In the
 * Compact Layout, where the Panel buttons stack down that corner, just left
 * of their column, `margin` from it and only `compactSize` square, so the
 * pause button below it clears the touch controls.
 */
export function miniMapLayout(screen: Viewport): Rect {
  const scaled = atUiScale(MINI_MAP, screen.uiScale);
  const { margin } = scaled;
  const size = screen.compact ? scaled.compactSize : scaled.size;
  return {
    x: topRightEdge(screen) - margin - size,
    y: margin,
    w: size,
    h: size,
  };
}

/**
 * How much of the World's size a tile takes on the Mini Map: its frame grows
 * with the UI Scale, so the map in it does too, to read the same on any
 * screen.
 */
export function miniMapScale(screen: Viewport): number {
  return MINI_MAP.scale * screen.uiScale;
}

/**
 * Whether the Mini Map shows: but while the Map Overlay or a panel is open,
 * and during Death.
 */
export function miniMapShown(
  menus: Pick<
    Menus,
    | "mapOpen"
    | "heroPanelOpen"
    | "inventoryOpen"
    | "skillTreeOpen"
    | "questOpen"
    | "waypointsOpen"
    | "dialogueOpen"
    | "vendorOpen"
  >,
  heroDead: boolean,
): boolean {
  return !heroDead && !menus.mapOpen && !anyPanelOpen(menus);
}

/** The Mini Map, which opens the Map Overlay when clicked. */
export type MiniMapButton = { type: "miniMap" };

/** A click on the Mini Map, so not for the World. */
export type MiniMapHit = { button: MiniMapButton };

/** The Mini Map when `point` is on it, or null off it. */
export function miniMapHitAt(screen: Viewport, point: Vec): MiniMapHit | null {
  return inside(miniMapLayout(screen), point)
    ? { button: { type: "miniMap" } }
    : null;
}

/**
 * Where the Mini Map's tooltip, `size` big, goes: under it, `gap` away,
 * kept on the screen.
 */
export function miniMapTooltipRect(
  screen: Viewport,
  size: { w: number; h: number },
  gap: number,
): Rect {
  const over = miniMapLayout(screen);
  return {
    ...tooltipRect(over, size, screen, gap),
    y: over.y + over.h + gap,
  };
}
