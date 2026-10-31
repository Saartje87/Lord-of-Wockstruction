/**
 * Prints one Area as a tile grid with row and column numbers, as the sim
 * loads it from `content/areas/<area>.tmj`: void, floor, Water, blocking
 * Walls and Props, and what the Area places (Exits, Entries, Monster spawns,
 * Unique Monsters, the Act Boss, NPCs, the Waypoint, Bone Altars and the Town
 * Portal), with a legend (`areaMap` in `src/game/sim/areaMap.ts`).
 *
 * Run it with `npm run area:map <area>`, e.g. `npm run area:map spa`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { runnerImport } from "vite";
import type * as AreaModule from "../src/game/sim/area.ts";
import type * as AreaMapModule from "../src/game/sim/areaMap.ts";

// The sim's imports have no extensions, which Node can't resolve on its own.
const load = async <T,>(path: string) =>
  (await runnerImport<T>(path, { configFile: false, logLevel: "error" }))
    .module;

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

const areas = readJsonDir("content/areas", ".tmj");
const name = process.argv[2];
if (name === undefined || !Object.hasOwn(areas, name)) {
  console.error(
    `${name === undefined ? "Name an Area" : `No Area "${name}"`}: npm run area:map <area>, one of ${Object.keys(areas).join(", ")}`,
  );
  process.exit(1);
}

const { loadArea } = await load<typeof AreaModule>("./src/game/sim/area.ts");
const { areaMap } = await load<typeof AreaMapModule>(
  "./src/game/sim/areaMap.ts",
);
const tilesets = readJsonDir("content/tilesets", ".tsj");
console.log(areaMap(loadArea(name, areas[name], tilesets)));
