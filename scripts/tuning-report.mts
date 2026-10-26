/**
 * Prints each Monster type's numbers from the live tuning, as `tuningReport`
 * in `src/game/sim/tuningReport.ts` works them out: per Hero Level, the
 * Experience to the next and the kills of own-Level Monsters it takes, and
 * per Combat Area in `content/areas/`, its Area Level and the Monster there.
 *
 * Run it with `npm run tuning:report`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { runnerImport } from "vite";
import type * as AreaModule from "../src/game/sim/area.ts";
import type * as ReportModule from "../src/game/sim/tuningReport.ts";
import type * as MonstersModule from "../src/game/tuning/monsters.ts";
import type { MonsterType } from "../src/game/tuning/monsters.ts";

// The sim's imports have no extensions, which Node can't resolve on its own.
const load = async <T,>(path: string) =>
  (await runnerImport<T>(path, { configFile: false, logLevel: "error" }))
    .module;
const { loadArea } = await load<typeof AreaModule>("./src/game/sim/area.ts");
const { tuningReport } = await load<typeof ReportModule>(
  "./src/game/sim/tuningReport.ts",
);
const { monsterTuning } = await load<typeof MonstersModule>(
  "./src/game/tuning/monsters.ts",
);

/** Every `.json`-shaped file in `dir` with extension `ext`, by base name. */
function readJsonDir(dir: string, ext: string): Record<string, unknown> {
  return Object.fromEntries(
    readdirSync(dir)
      .filter((file) => file.endsWith(ext))
      .map((file) => [
        basename(file, ext),
        JSON.parse(readFileSync(`${dir}/${file}`, "utf8")),
      ]),
  );
}

const tilesets = readJsonDir("content/tilesets", ".tsj");
const areas = Object.entries(readJsonDir("content/areas", ".tmj")).map(
  ([name, tmj]) => loadArea(name, tmj, tilesets),
);

/** Rows as a table with right-aligned columns under `headers`. */
function table(headers: string[], rows: (string | number)[][]): string {
  const cells = [headers, ...rows.map((row) => row.map(String))];
  const widths = headers.map((_, i) =>
    Math.max(...cells.map((row) => row[i].length)),
  );
  return cells
    .map((row) => row.map((cell, i) => cell.padStart(widths[i])).join("  "))
    .join("\n");
}

const grouped = (n: number) => n.toLocaleString("en-GB");

for (const [type, { name }] of Object.entries(monsterTuning)) {
  const report = tuningReport(type as MonsterType, areas);
  console.log(`# ${name}: Hero Levels, against own-Level ${name}s\n`);
  console.log(
    table(
      ["Level", "To next", `${name} Experience`, "Kills"],
      report.levels.map((row) => [
        row.level,
        grouped(row.toNext),
        grouped(row.killExperience),
        grouped(row.kills),
      ]),
    ),
  );
  console.log(`\n# ${name}: Combat Areas\n`);
  console.log(
    table(
      [
        "Combat Area",
        "Area Level",
        "Max Life",
        "Damage",
        "Attack Rating",
        "Defense",
        "Experience",
      ],
      report.areas.map((row) => [
        row.area,
        row.areaLevel,
        grouped(row.maxLife),
        `${row.damage[0]}–${row.damage[1]}`,
        row.attackRating,
        row.defense,
        grouped(row.experience),
      ]),
    ),
  );
  console.log();
}
