import type { ItemId } from "../sim/inventory";
import { inside, overlaps, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import { atUiScale } from "../viewport";

/**
 * A Ground Item's name label (CSS px at native scale, drawn at the UI
 * Scale): `height` tall with its name `textSize` tall and `padding` either
 * side of it, its bottom `above` the Item, and `gap` between labels stacked
 * to keep clear of each other.
 */
export const GROUND_LABEL = {
  height: 18,
  above: 6,
  gap: 2,
  padding: 6,
  textSize: 13,
};

/** Where one Ground Item's label goes. */
export type GroundLabel = { id: ItemId; rect: Rect };

/**
 * Lays out the labels of Ground Items at `at` on screen, each `width` wide,
 * at the UI Scale `uiScale`: centred over its Item, and moved up past any
 * nearer label it would overlap, as Diablo 2 stacks them.
 */
export function groundLabels(
  items: readonly { id: ItemId; at: Vec; width: number }[],
  uiScale: number,
): GroundLabel[] {
  const { height, above, gap } = atUiScale(GROUND_LABEL, uiScale);
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
      const under = placed.find((label) => overlaps(label.rect, rect));
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

/**
 * The Ground Item drawn on the floor under `point`: within `half` of its
 * centre `at` across and down, the one nearest the viewer where they
 * overlap, or null.
 */
export function groundItemUnder(
  items: readonly { id: ItemId; at: Vec }[],
  point: Vec,
  half: number,
): ItemId | null {
  let nearest: { id: ItemId; y: number } | null = null;
  for (const { id, at } of items) {
    const under =
      Math.abs(point.x - at.x) <= half && Math.abs(point.y - at.y) <= half;
    if (under && (!nearest || at.y > nearest.y)) nearest = { id, y: at.y };
  }
  return nearest?.id ?? null;
}
