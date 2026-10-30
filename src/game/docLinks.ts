/**
 * Every `?area=<Area>` and `?area=<Area>&entry=<Entry>` link in `docs` that
 * names an Area, or an Entry of it, missing from `entriesOf` (each Area's
 * Entry names). One message per bad link, naming the file, the link and
 * what's missing.
 */
export function docLinkProblems(
  docs: { file: string; text: string }[],
  entriesOf: Record<string, string[]>,
): string[] {
  const problems: string[] = [];
  for (const { file, text } of docs) {
    for (const [link, area, entry] of text.matchAll(
      /\?area=([\w-]+)(?:&entry=([\w-]+))?/g,
    )) {
      if (!Object.hasOwn(entriesOf, area)) {
        problems.push(`${file}: ${link}: no Area "${area}"`);
      } else if (entry !== undefined && !entriesOf[area].includes(entry)) {
        problems.push(
          `${file}: ${link}: Area "${area}" has no Entry "${entry}"`,
        );
      }
    }
  }
  return problems;
}
