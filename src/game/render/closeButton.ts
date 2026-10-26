import type { Panel } from "../menus";
import { inside, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";

/**
 * The × close button in a panel's top-right corner (CSS px): `size` square,
 * `inset` in from the panel's top and right edges, its × drawn `cross` in
 * from the button's edges.
 */
export const CLOSE_BUTTON = { size: 22, inset: 10, cross: 6 };

/** A panel's × close button, which shuts it as its key does. */
export type CloseButton = { type: "close"; panel: Panel };

/** Where the × close button of a panel drawn at `panel` goes. */
export function closeButtonRect(panel: Rect): Rect {
  const { size, inset } = CLOSE_BUTTON;
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
  panel: Panel,
): { button: CloseButton } | null {
  if (!inside(layout.closeButton, point)) return null;
  return { button: { type: "close", panel } };
}
