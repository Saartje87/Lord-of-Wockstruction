import type { Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import type { BossBar } from "../sim/world";
import { atUiScale, type Viewport } from "../viewport";

/** What the Boss bar shows: the Act Boss's name and how full its Life bar is. */
export type BossBarContent = { name: string; fraction: number };

/** The fraction of the Boss's Life the bar's mark stands at: half. */
export const BOSS_BAR_MARK = 0.5;

/**
 * The Boss bar (CSS px at native scale, drawn at the UI Scale): a panel
 * `width` wide and `height` tall `top` from the screen's top, with the name
 * `nameSize` tall `nameTop` below its top and a Life bar `barHeight` tall
 * `barBottom` above its bottom, inset `inset` from the panel's sides. It
 * keeps `margin` from the screen's sides, shrinking on a narrow screen. The
 * mark is `markWidth` wide and sticks out `markOverhang` above and below the
 * Life bar.
 */
export const BOSS_BAR = {
  width: 360,
  height: 36,
  top: 10,
  nameTop: 2,
  nameSize: 15,
  barHeight: 12,
  barBottom: 5,
  inset: 8,
  margin: 8,
  markWidth: 2,
  markOverhang: 2,
};

/** What the Boss bar shows for the World's query, or null for no bar. */
export function bossBarOf(bar: BossBar | null): BossBarContent | null {
  if (!bar) return null;
  return { name: bar.name, fraction: Math.max(0, bar.life / bar.maxLife) };
}

/**
 * Where the Boss bar's panel, Life bar and half-Life mark are drawn, where
 * its name's top centre goes, and how big the name is.
 */
export function bossBarLayout(screen: Viewport): {
  panel: Rect;
  bar: Rect;
  mark: Rect;
  nameAt: Vec;
  nameSize: number;
} {
  const sizes = atUiScale(BOSS_BAR, screen.uiScale);
  const width = Math.min(sizes.width, screen.width - 2 * sizes.margin);
  const centre = screen.width / 2;
  const panel = {
    x: centre - width / 2,
    y: sizes.top,
    w: width,
    h: sizes.height,
  };
  const bar = {
    x: panel.x + sizes.inset,
    y: panel.y + panel.h - sizes.barHeight - sizes.barBottom,
    w: width - 2 * sizes.inset,
    h: sizes.barHeight,
  };
  return {
    panel,
    bar,
    mark: {
      x: bar.x + bar.w * BOSS_BAR_MARK - sizes.markWidth / 2,
      y: bar.y - sizes.markOverhang,
      w: sizes.markWidth,
      h: bar.h + 2 * sizes.markOverhang,
    },
    nameAt: { x: centre, y: panel.y + sizes.nameTop },
    nameSize: sizes.nameSize,
  };
}
