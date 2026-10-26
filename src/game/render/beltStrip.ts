import { beltColumnKey, beltOf } from "../sim/belt";
import { inside, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import type { World } from "../sim/world";
import { beltTuning, type ItemType, itemOf } from "../tuning/items";
import { SKILL_BAR, skillBarLayout } from "./skillBar";

/**
 * The HUD's Belt strip (CSS px): one square per Belt Column, as big and as
 * far apart as the Skill Bar's slots, ending `toSkillBar` left of it.
 */
export const BELT_STRIP = { toSkillBar: 16 };

/** Where each Belt Column's square of the Belt strip is drawn, from the left. */
export function beltStripLayout(screen: { width: number; height: number }): {
  columns: Rect[];
} {
  const { slot, gap } = SKILL_BAR;
  const { key1 } = skillBarLayout(screen).slots;
  const count = beltTuning.columns;
  const width = count * slot + (count - 1) * gap;
  const left = key1.x - BELT_STRIP.toSkillBar - width;
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
 * A click on a Belt Column's square of the Belt strip: no button, but not
 * for the World either.
 */
export type BeltStripHit = { button: null };

/** What a click at `point` hits of the Belt strip, or null off its squares. */
export function beltStripHitAt(
  screen: { width: number; height: number },
  point: Vec,
): BeltStripHit | null {
  const onStrip = beltStripLayout(screen).columns.some((rect) =>
    inside(rect, point),
  );
  return onStrip ? { button: null } : null;
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
