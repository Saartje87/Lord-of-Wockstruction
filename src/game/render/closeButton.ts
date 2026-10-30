import type { ClosablePanel } from "../menus";
import { inside, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import { atUiScale } from "../viewport";

/**
 * The × close button in a panel's top-right corner (CSS px at native scale,
 * drawn at the UI Scale like its panel): `size` square,
 * `inset` in from the panel's top and right edges, its × drawn `cross` in
 * from the button's edges.
 */
export const CLOSE_BUTTON = { size: 22, inset: 10, cross: 6 };

/** A panel's × close button, which shuts it as its key does. */
export type CloseButton = { type: "close"; panel: ClosablePanel };

/**
 * Where the × close button of a panel drawn at `panel` goes, at the UI
 * Scale `uiScale`.
 */
export function closeButtonRect(panel: Rect, uiScale: number): Rect {
  const { size, inset } = atUiScale(CLOSE_BUTTON, uiScale);
  return {
    x: panel.x + panel.w - inset - size,
    y: panel.y + inset,
    w: size,
    h: size,
  };
}

/** The × of `panel`, laid out as `layout`, when `point` is on it, else null. */
export function closeHitAt(
  layout: { closeButton: Rect },
  point: Vec,
  panel: ClosablePanel,
): { button: CloseButton } | null {
  if (!inside(layout.closeButton, point)) return null;
  return { button: { type: "close", panel } };
}
