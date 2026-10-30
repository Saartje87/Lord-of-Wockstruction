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
