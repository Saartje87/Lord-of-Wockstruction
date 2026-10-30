import type { Rect } from "../sim/rect";
import { type MinionType, minionMaxLife, type World } from "../sim/world";
import { atUiScale, type Viewport } from "../viewport";

/**
 * Every Minion kind's place in the Minion Frame, top row first. A new kind
 * needs a place here and an icon in the renderer, and no more.
 */
export const MINION_KINDS: Record<MinionType, { place: number }> = {
  golem: { place: 0 },
  raisedSkeleton: { place: 1 },
  raisedArcher: { place: 2 },
};

/** One Minion's Life bar: who it is and how much Life it has left (0..1). */
export type MinionBar = { id: number; fraction: number };

/** A Minion kind's row of the Minion Frame, its bars oldest first. */
export type MinionRow = { kind: MinionType; bars: MinionBar[] };

/**
 * The Minion Frame's rows: one per Minion kind with any alive, in the kinds'
 * places, each with a bar per Minion of it, oldest first as the World keeps
 * them. None for a Hero without Minions.
 */
export function minionFrameRows(world: World): MinionRow[] {
  const rows = new Map<MinionType, MinionBar[]>();
  for (const minion of world.minions) {
    const bars = rows.get(minion.type) ?? [];
    const fraction = minion.life / minionMaxLife(minion);
    bars.push({ id: minion.id, fraction: Math.min(1, Math.max(0, fraction)) });
    rows.set(minion.type, bars);
  }
  return [...rows]
    .map(([kind, bars]) => ({ kind, bars }))
    .sort((a, b) => MINION_KINDS[a.kind].place - MINION_KINDS[b.kind].place);
}

/**
 * The Minion Frame (CSS px at native scale, drawn at the UI Scale): `margin`
 * from the screen's top left, each row an `icon` square, `iconGap` and then
 * its bars, each `barWidth` by `barHeight` and `barGap` apart, the rows
 * `rowGap` apart.
 */
export const MINION_FRAME = {
  margin: 12,
  icon: 24,
  iconGap: 6,
  barWidth: 16,
  barHeight: 5,
  barGap: 3,
  rowGap: 6,
};

/** The most bars on one line of a row; a longer row wraps onto more lines. */
export const BARS_PER_LINE = 10;

/** Where one row's icon and bars are drawn. */
export type MinionRowLayout = { kind: MinionType; icon: Rect; bars: Rect[] };

/**
 * Where the Minion Frame is drawn: at the top left, `rows` stacked down. Its
 * `frame` is the box round all of them, null without rows.
 */
export function minionFrameLayout(
  screen: Viewport,
  rows: readonly MinionRow[],
): { frame: Rect | null; rows: MinionRowLayout[] } {
  if (rows.length === 0) return { frame: null, rows: [] };
  const size = atUiScale(MINION_FRAME, screen.uiScale);
  const barsLeft = size.margin + size.icon + size.iconGap;
  const stride = size.barHeight + size.barGap;
  let y = size.margin;
  let right = barsLeft;
  const laidOut = rows.map(({ kind, bars }) => {
    const lines = Math.max(1, Math.ceil(bars.length / BARS_PER_LINE));
    const barsHeight = lines * stride - size.barGap;
    const height = Math.max(size.icon, barsHeight);
    // The bars centred on the icon when they fit beside it.
    const top = y + (height - barsHeight) / 2;
    const rects = bars.map((_, i) => ({
      x: barsLeft + (i % BARS_PER_LINE) * (size.barWidth + size.barGap),
      y: top + Math.floor(i / BARS_PER_LINE) * stride,
      w: size.barWidth,
      h: size.barHeight,
    }));
    for (const rect of rects) right = Math.max(right, rect.x + rect.w);
    const row = {
      kind,
      icon: { x: size.margin, y, w: size.icon, h: size.icon },
      bars: rects,
    };
    y += height + size.rowGap;
    return row;
  });
  const frame = {
    x: size.margin,
    y: size.margin,
    w: right - size.margin,
    h: y - size.rowGap - size.margin,
  };
  return { frame, rows: laidOut };
}
