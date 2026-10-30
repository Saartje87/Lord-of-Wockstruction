/** How long a Minion that died or was replaced takes to crumble away. */
export const CRUMBLE_SECONDS = 0.6;

/** How far, in tiles, a crumbling Minion has sunk into the floor at the end. */
const SINK_TILES = 0.6;

/** How a crumbling Minion looks: its size, and how deep it has sunk. */
export type Crumble = { scale: number; sink: number };

/** The look of a Minion `seconds` into crumbling: it sinks and shrinks away. */
export function crumbleOf(seconds: number): Crumble {
  const progress = Math.min(1, Math.max(0, seconds / CRUMBLE_SECONDS));
  return {
    scale: progress >= 1 ? 0 : 1 - progress * progress,
    sink: progress * SINK_TILES,
  };
}

/**
 * The crumbling Minions after `dt` seconds: how long ago each began, by id.
 * Those in `previous` but not in `current` just left the World and begin;
 * those that have run their course are dropped.
 */
export function crumblesAfter(
  crumbling: ReadonlyMap<number, number>,
  previous: ReadonlySet<number>,
  current: ReadonlySet<number>,
  dt: number,
): Map<number, number> {
  const next = new Map<number, number>();
  for (const [id, seconds] of crumbling) {
    if (seconds + dt < CRUMBLE_SECONDS) next.set(id, seconds + dt);
  }
  for (const id of previous) {
    if (!current.has(id) && !next.has(id)) next.set(id, 0);
  }
  return next;
}
