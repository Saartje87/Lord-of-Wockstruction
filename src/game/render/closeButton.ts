import type { Rect } from "../sim/rect";

/**
 * The × close button in a panel's top-right corner (CSS px): `size` square,
 * `inset` in from the panel's top and right edges, its × drawn `cross` in
 * from the button's edges.
 */
export const CLOSE_BUTTON = { size: 22, inset: 10, cross: 6 };

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
