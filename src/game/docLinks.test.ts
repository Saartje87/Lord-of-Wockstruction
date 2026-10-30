import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { areas, tilesets } from "./content";
import { docLinkProblems } from "./docLinks";
import { createWorld } from "./sim/world";

/** Each shipped Area's Entry names, loaded as the shipped-content tests load them. */
const entriesOf = Object.fromEntries(
  Object.entries(createWorld({ areas, tilesets, seed: 1 }).areas).map(
    ([name, area]) => [name, Object.keys(area.entries)],
  ),
);

const known = { town: ["start", "from-cave"], cave: ["start"] };

describe("the doc link check", () => {
  it("passes links to an Area and Entry that exist, and an Area alone", () => {
    const text =
      "Go to http://localhost:3000/?area=cave&entry=start, or ?area=town.";
    expect(docLinkProblems([{ file: "a.md", text }], known)).toEqual([]);
  });

  it("names the file, the link and the Area that's missing", () => {
    const text = "See ?area=nowhere&entry=start now.";
    expect(docLinkProblems([{ file: "docs/a.md", text }], known)).toEqual([
      'docs/a.md: ?area=nowhere&entry=start: no Area "nowhere"',
    ]);
  });

  it("names the Entry that's missing", () => {
    const text = "See ?area=cave&entry=gone.";
    expect(docLinkProblems([{ file: "docs/a.md", text }], known)).toEqual([
      'docs/a.md: ?area=cave&entry=gone: Area "cave" has no Entry "gone"',
    ]);
  });

  it("checks an Area-only link for its Area alone", () => {
    const text = "Try ?area=nowhere.";
    expect(docLinkProblems([{ file: "b.md", text }], known)).toEqual([
      'b.md: ?area=nowhere: no Area "nowhere"',
    ]);
  });
});

describe("the links in the docs", () => {
  it("name Areas and Entries the game ships", () => {
    const files = [
      "README.md",
      ...readdirSync("docs/agents")
        .filter((name) => name.endsWith(".md"))
        .map((name) => `docs/agents/${name}`),
    ];
    const docs = files.map((file) => ({
      file,
      text: readFileSync(file, "utf8"),
    }));
    expect(docLinkProblems(docs, entriesOf)).toEqual([]);
  });
});
