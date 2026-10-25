import { readFileSync } from "node:fs";

/**
 * Reads the "Art" section of Flare's `CREDITS.txt`: the artists of Flare's
 * own art, which the per-file listing doesn't attribute file by file.
 */
export function readFlareArtists(path: string): string[] {
  const lines = readFileSync(path, "utf8").split("\n");
  const start = lines.indexOf("Art") + 1;
  const end = lines.indexOf("Additional Art", start);
  return lines
    .slice(start, end)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Filters the wiki's per-file credits (`Credits.md`) to the entries that
 * mention one of `paths` (prefixes, like `/art_src/characters/skeleton/`),
 * keeping each entry's role, licence and matching lines, under its section.
 */
export function filterFileCredits(path: string, paths: string[]): string {
  const out: string[] = [];
  let section = "";
  let entry: string | null = null;
  let license: string[] = [];
  let matches: string[] = [];
  let printedSection = "";

  const flush = () => {
    if (entry && matches.length > 0) {
      if (printedSection !== section) {
        out.push(`#### ${section}`, "");
        printedSection = section;
      }
      out.push(entry, "", ...license, ...matches, "");
    }
    entry = null;
    license = [];
    matches = [];
  };

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      flush();
      section = trimmed.slice(3);
    } else if (trimmed.startsWith("* ")) {
      if (/^\* License:/i.test(trimmed)) license.push(trimmed);
      else if (paths.some((p) => trimmed.includes(p))) matches.push(trimmed);
    } else if (trimmed) {
      flush();
      entry = trimmed;
    }
  }
  flush();
  return out.join("\n").trim();
}
