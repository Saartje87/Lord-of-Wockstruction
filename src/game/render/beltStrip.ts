import type { InputWay } from "../input/activeInput";
import { beltOf } from "../sim/belt";
import { inside, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import type { World } from "../sim/world";
import { beltTuning, type ItemType, itemOf } from "../tuning/items";
import { atUiScale, type Viewport } from "../viewport";
import { beltColumnButton } from "./hints";
import { BELT_STRIP, SKILL_BAR, skillBarLayout } from "./skillBar";

/** Where each Belt Column's square of the Belt strip is drawn, from the left. */
export function beltStripLayout(screen: Viewport): {
  columns: Rect[];
} {
  const { slot, gap } = atUiScale(SKILL_BAR, screen.uiScale);
  const { toSkillBar } = atUiScale(BELT_STRIP, screen.uiScale);
  const { key1 } = skillBarLayout(screen).slots;
  const count = beltTuning.columns;
  const width = count * slot + (count - 1) * gap;
  const left = key1.x - toSkillBar - width;
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
 * What a Belt Column's square shows: the key or button that drinks from it, its
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

/**
 * What the Belt strip shows, Belt Column by Belt Column from the left, each
 * naming the button that drinks from it with the Active Input `way`.
 */
export function beltStripSheet(
  world: World,
  way: InputWay = "mouseAndKeyboard",
): BeltStripColumnSheet[] {
  return beltOf(world).map((potions, column) => {
    const bottom = potions[0]?.type ?? null;
    return {
      column,
      key: beltColumnButton(column, way),
      type: bottom,
      name: bottom && itemOf(bottom).name,
      count: potions.length,
    };
  });
}
