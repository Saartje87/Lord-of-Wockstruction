import type { ItemId } from "../sim/inventory";
import type { Vec } from "../sim/vec";
import { inside, type Rect } from "./rect";

/**
 * A Ground Item's name label (CSS px): `height` tall, its bottom `above` the
 * Item, and `gap` between labels stacked to keep clear of each other.
 */
export const GROUND_LABEL = { height: 18, above: 6, gap: 2, padding: 6 };

/** Where one Ground Item's label goes. */
export type GroundLabel = { id: ItemId; rect: Rect };

/**
 * Lays out the labels of Ground Items at `at` on screen, each `width` wide:
 * centred over its Item, and moved up past any nearer label it would
 * overlap, as Diablo 2 stacks them.
 */
export function groundLabels(
  items: readonly { id: ItemId; at: Vec; width: number }[],
): GroundLabel[] {
  const { height, above, gap } = GROUND_LABEL;
  // Nearest the viewer first, so theirs stay lowest.
  const nearestFirst = [...items].sort((a, b) => b.at.y - a.at.y);
  const placed: GroundLabel[] = [];
  for (const { id, at, width } of nearestFirst) {
    const rect = {
      x: at.x - width / 2,
      y: at.y - above - height,
      w: width,
      h: height,
    };
    for (;;) {
      const under = placed.find((label) => overlap(label.rect, rect));
      if (!under) break;
      rect.y = under.rect.y - gap - height;
    }
    placed.push({ id, rect });
  }
  return placed;
}

/** The Ground Item whose label is under `point`, or null. */
export function groundLabelAt(
  labels: readonly GroundLabel[],
  point: Vec,
): ItemId | null {
  return labels.find((label) => inside(label.rect, point))?.id ?? null;
}

function overlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}
