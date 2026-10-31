import type { AreaEntry } from "./sim/world";

/**
 * Where a playtest starts, from a query such as
 * `?area=catacombs&entry=from-town`, or null without both. Dev builds only:
 * see `GameCanvas`.
 */
export function devStartOf(search: string): AreaEntry | null {
  const query = new URLSearchParams(search);
  const area = query.get("area");
  const entry = query.get("entry");
  return area && entry ? { area, entry } : null;
}

/**
 * Whether the Start Screen is skipped, play beginning in the requested Area
 * once loading is done: in a `development` build, with a dev start in the
 * query.
 */
export function skipsStartScreen(
  search: string,
  development: boolean,
): boolean {
  return development && devStartOf(search) !== null;
}
