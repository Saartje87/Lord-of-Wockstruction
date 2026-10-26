import { beltColumnKey, beltOf } from "../sim/belt";
import { inside, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import type { World } from "../sim/world";
import { beltTuning, type ItemType, itemOf } from "../tuning/items";
import type { Viewport } from "../viewport";
import { SKILL_BAR, skillBarLayout } from "./skillBar";

/**
 * The HUD's Belt strip (CSS px at native scale, drawn at the UI Scale): one square per Belt Column, as big and as
 * far apart as the Skill Bar's slots, ending `toSkillBar` left of it.
 */
export const BELT_STRIP = { toSkillBar: 16 };

/** Where each Belt Column's square of the Belt strip is drawn, from the left. */
export function beltStripLayout(screen: Viewport): {
  columns: Rect[];
} {
  const slot = SKILL_BAR.slot * screen.uiScale;
  const gap = SKILL_BAR.gap * screen.uiScale;
  const { key1 } = skillBarLayout(screen).slots;
  const count = beltTuning.columns;
  const width = count * slot + (count - 1) * gap;
  const left = key1.x - BELT_STRIP.toSkillBar * screen.uiScale - width;
  return {
    columns: Array.from({ length: count }, (_, index) => ({
      x: left + index * (slot + gap),
      y: key1.y,
      w: slot,
      h: slot,
    })),
  };
}

/**
 * A point on a Belt Column's square of the Belt strip: no button, but not
 * for the World either. Lifting there takes the column's bottom Potion, and
 * putting a Potion down there puts it in at the lowest free row.
 */
export type BeltStripHit = { button: null; beltColumn: number };

/**
 * What a point hits of the Belt strip: the Belt Column whose square it is
 * on, or null off its squares.
 */
export function beltStripHitAt(
  screen: Viewport,
  point: Vec,
): BeltStripHit | null {
  const beltColumn = beltStripLayout(screen).columns.findIndex((rect) =>
    inside(rect, point),
  );
  return beltColumn === -1 ? null : { button: null, beltColumn };
}

/**
 * What a Belt Column's square shows: the key that drinks from it, its
 * bottom Potion (the one drunk next) or null when empty, and how many
 * Potions it holds.
 */
export type BeltStripColumnSheet = {
  column: number;
  key: string;
  type: ItemType | null;
  name: string | null;
  count: number;
};

/** What the Belt strip shows, Belt Column by Belt Column from the left. */
export function beltStripSheet(world: World): BeltStripColumnSheet[] {
  return beltOf(world).map((potions, column) => {
    const bottom = potions[0]?.type ?? null;
    return {
      column,
      key: beltColumnKey(column),
      type: bottom,
      name: bottom && itemOf(bottom).name,
      count: potions.length,
    };
  });
}
