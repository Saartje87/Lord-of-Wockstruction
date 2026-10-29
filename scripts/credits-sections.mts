import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * `CREDITS.md` is shared by the import scripts. Each owns a section between
 * `<!-- begin NAME -->` and `<!-- end NAME -->` lines, and rewrites only that.
 */
const begin = (name: string) => `<!-- begin ${name} -->`;
const end = (name: string) => `<!-- end ${name} -->`;

/** The marked section `name` of `text`, markers included, or "" if none. */
export function sectionOf(text: string, name: string): string {
  const from = text.indexOf(begin(name));
  const to = text.indexOf(end(name));
  if (from === -1 || to === -1) return "";
  return text.slice(from, to + end(name).length);
}

/** `body` between `name`'s markers. */
export function marked(name: string, body: string): string {
  return `${begin(name)}\n${body.trim()}\n${end(name)}`;
}

/**
 * Writes `body` as the section `name` of the credits file at `path`: in place
 * of the section there, else at the end. Other sections stay as they are.
 */
export function writeSection(path: string, name: string, body: string) {
  const section = marked(name, body);
  const existing = existsSync(path)
    ? readFileSync(path, "utf8")
    : "# Credits\n";
  const old = sectionOf(existing, name);
  const text = old
    ? existing.replace(old, section)
    : `${existing.trimEnd()}\n\n${section}\n`;
  writeFileSync(path, text);
}
