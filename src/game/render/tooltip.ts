import type { Rect } from "../sim/rect";
import type { Screen } from "../viewport";

/**
 * Where a tooltip `size` big goes: centred over `under`, `gap` above it, or
 * `gap` under it where there's no room above, and kept on the screen (over
 * what it is about if it fits neither above nor below).
 */
export function tooltipRect(
  under: Rect,
  size: { w: number; h: number },
  screen: Screen,
  gap: number,
): Rect {
  const above = under.y - gap - size.h;
  return {
    x: Math.min(
      screen.width - size.w,
      Math.max(0, under.x + under.w / 2 - size.w / 2),
    ),
    y: Math.max(
      0,
      Math.min(
        screen.height - size.h,
        above >= 0 ? above : under.y + under.h + gap,
      ),
    ),
    w: size.w,
    h: size.h,
  };
}
