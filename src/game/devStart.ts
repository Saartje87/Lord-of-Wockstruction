/**
 * Where a playtest starts, from a query such as
 * `?area=catacombs&entry=from-town`, or null without both. Dev builds only:
 * see `GameCanvas`.
 */
export function devStartOf(
  search: string,
): { area: string; entry: string } | null {
  const query = new URLSearchParams(search);
  const area = query.get("area");
  const entry = query.get("entry");
  return area && entry ? { area, entry } : null;
}
