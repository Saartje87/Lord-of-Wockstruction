/**
 * Prints how a fight with a Unique Monster alone goes, once per seed, as
 * `fightReport` in `src/game/sim/fightReport.ts` runs it: a Hero just reached
 * the given Level, with starting gear and stats, beside it in its Area, kept
 * alive and Attacking it in steady melee. Per seed, the seconds to kill it,
 * the hits the Hero took and that damage in Hero Lives; then the mean and
 * range.
 *
 * Run it with `npm run tuning:fight -- <area> <unique> [--level N] [--seeds N]`,
 * say `npm run tuning:fight -- spa Bruckle --level 3`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { runnerImport } from "vite";
import type * as FightModule from "../src/game/sim/fightReport.ts";
import type * as UnitsModule from "../src/game/sim/units.ts";

// The sim's imports have no extensions, which Node can't resolve on its own.
const load = async <T,>(path: string) =>
  (await runnerImport<T>(path, { configFile: false, logLevel: "error" }))
    .module;
const { fightReport } = await load<typeof FightModule>(
  "./src/game/sim/fightReport.ts",
);
const { STEPS_PER_SECOND } = await load<typeof UnitsModule>(
  "./src/game/sim/units.ts",
);

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    level: { type: "string", default: "1" },
    seeds: { type: "string", default: "20" },
  },
});
const [area, unique] = positionals;
if (!area || !unique) {
  console.error(
    "usage: npm run tuning:fight -- <area> <unique> [--level N] [--seeds N]",
  );
  process.exit(1);
}

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

const level = Number(values.level);
const fights = fightReport({
  areas: readJsonDir("content/areas", ".tmj"),
  tilesets: readJsonDir("content/tilesets", ".tsj"),
  area,
  unique,
  level,
  seeds: Number(values.seeds),
  maxTicks: 600 * STEPS_PER_SECOND,
});

const seconds = (ticks: number) => ticks / STEPS_PER_SECOND;
console.log(`# ${unique} in ${area}, alone, against a Level ${level} Hero\n`);
fights.forEach((fight, i) => {
  const kill = fight.killed
    ? `${seconds(fight.ticks).toFixed(1)} s`
    : `alive after ${seconds(fight.ticks)} s`;
  const lives = fight.damageTaken / fight.heroMaxLife;
  console.log(
    `seed ${String(i + 1).padStart(2)}: kill ${kill}, ${fight.hitsTaken} hits taken, ${Math.round(fight.damageTaken)} damage (${lives.toFixed(1)}× the Hero's ${fight.heroMaxLife} Life)`,
  );
});
const times = fights.map((fight) => seconds(fight.ticks));
const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
console.log(
  `\nkill time: mean ${mean.toFixed(1)} s, range ${Math.min(...times).toFixed(1)}–${Math.max(...times).toFixed(1)} s`,
);
