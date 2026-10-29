import type { Vec } from "../sim/vec";
import { townPortalLook } from "../tuning/townPortalLook";

/**
 * How big a Town Portal is `ms` after it opened, as a share of its full size:
 * bursting out of a point, springing past full size by up to about
 * `overshoot`, and settling at full size once `openMs` have passed.
 */
export function townPortalOpenScale(ms: number): number {
  const { openMs, overshoot } = townPortalLook;
  if (ms >= openMs) return 1;
  const t = Math.max(0, ms) / openMs;
  return 1 - (1 - t) ** 3 + overshoot * Math.sin(Math.PI * t);
}

/**
 * How big a Town Portal is `ms` after it closed, as a share of its full
 * size: shrinking slowly at first, then faster, to nothing once `closeMs`
 * have passed.
 */
export function townPortalCloseScale(ms: number): number {
  const { closeMs } = townPortalLook;
  if (ms >= closeMs) return 0;
  return (1 - Math.max(0, ms) / closeMs) ** 2;
}

/** A Town Portal end drawn, at `scale` of its full size, `msOpen` after opening. */
export type ShownTownPortal = { pos: Vec; scale: number; msOpen: number };

/**
 * The Town Portal ends to draw in `area` at `nowMs`: the open end
 * (`openedAtMs` is when it burst open, null for one already standing),
 * then any `closing` ends of the Area still shrinking away.
 */
export function shownTownPortals(input: {
  end: Vec | null;
  openedAtMs: number | null;
  closing: { area: string; pos: Vec; atMs: number }[];
  area: string;
  nowMs: number;
}): ShownTownPortal[] {
  const { end, openedAtMs, closing, area, nowMs } = input;
  const shown: ShownTownPortal[] = [];
  if (end) {
    const msOpen =
      openedAtMs === null ? Number.POSITIVE_INFINITY : nowMs - openedAtMs;
    shown.push({ pos: end, scale: townPortalOpenScale(msOpen), msOpen });
  }
  for (const shrinking of closing) {
    const scale = townPortalCloseScale(nowMs - shrinking.atMs);
    if (scale > 0 && shrinking.area === area) {
      shown.push({
        pos: shrinking.pos,
        scale,
        msOpen: Number.POSITIVE_INFINITY,
      });
    }
  }
  return shown;
}
