/**
 * Prints each Monster type's numbers from the live tuning, as `tuningReport`
 * in `src/game/sim/tuningReport.ts` works them out: per Hero Level, the
 * Experience to the next, the kills of own-Level Monsters it takes and the
 * Gold they drop in the Areas played at that Level, and
 * per Combat Area in `content/areas/` that places it, its Area Level and the
 * Monster there. Then each Unique Monster's numbers, and each cast Skill's
 * numbers per Skill Level, with Synergies and Passive Skills, and the casts it
 * takes to kill each kind of Monster in each Combat Area (`skillReport` in
 * `src/game/sim/skillReport.ts`). Last, each Minion kind's chance to hit,
 * damage and a full group's time to kill an own-Level trash Skeleton at a few
 * Hero Levels (`minionReport` in `src/game/sim/minionReport.ts`).
 *
 * Run it with `npm run tuning:report`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { runnerImport } from "vite";
import type * as AreaModule from "../src/game/sim/area.ts";
import type * as MinionReportModule from "../src/game/sim/minionReport.ts";
import type { MinionLevelRow } from "../src/game/sim/minionReport.ts";
import type * as SkillReportModule from "../src/game/sim/skillReport.ts";
import type * as ReportModule from "../src/game/sim/tuningReport.ts";
import type { UniqueRow } from "../src/game/sim/tuningReport.ts";
import type * as MonstersModule from "../src/game/tuning/monsters.ts";
import type { MonsterType } from "../src/game/tuning/monsters.ts";
import type * as SkillsModule from "../src/game/tuning/skills.ts";

// The sim's imports have no extensions, which Node can't resolve on its own.
const load = async <T,>(path: string) =>
  (await runnerImport<T>(path, { configFile: false, logLevel: "error" }))
    .module;
const { loadArea } = await load<typeof AreaModule>("./src/game/sim/area.ts");
const { bossReport, tuningReport, uniqueReport } = await load<
  typeof ReportModule
>("./src/game/sim/tuningReport.ts");
const { skillReport } = await load<typeof SkillReportModule>(
  "./src/game/sim/skillReport.ts",
);
const { minionReport, RAISE_SKELETON_SHARE, SUMMONING_PASSIVES } = await load<
  typeof MinionReportModule
>("./src/game/sim/minionReport.ts");
const { skillTuning } = await load<typeof SkillsModule>(
  "./src/game/tuning/skills.ts",
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

/** The Monster numbers a Combat Area row and a Unique Monster row share. */
const numberCells = (row: UniqueRow) => [
  grouped(row.maxLife),
  `${row.damage[0]}–${row.damage[1]}`,
  row.attackRating,
  row.defense,
  grouped(row.experience),
];

for (const [type, { name }] of Object.entries(monsterTuning)) {
  const report = tuningReport(type as MonsterType, areas);
  console.log(`# ${name}: Hero Levels, against own-Level ${name}s\n`);
  console.log(
    table(
      [
        "Level",
        "To next",
        `${name} Experience`,
        "Kills",
        "Area Level",
        "Gold a kill",
        "Gold",
      ],
      report.levels.map((row) => [
        row.level,
        grouped(row.toNext),
        grouped(row.killExperience),
        grouped(row.kills),
        row.gold?.areaLevel ?? "–",
        row.gold ? row.gold.perKill.toFixed(2) : "–",
        row.gold ? row.gold.total.toFixed(1) : "–",
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
      report.areas.map((row) => [row.area, row.areaLevel, ...numberCells(row)]),
    ),
  );
  console.log();
}

const uniqueRows = areas.flatMap(({ name, areaLevel, uniques }) =>
  areaLevel === null
    ? []
    : uniques.map((unique) => ({ area: name, areaLevel, unique })),
);
if (uniqueRows.length > 0) {
  console.log("# Unique Monsters, with the Unique multipliers\n");
  console.log(
    table(
      [
        "Unique",
        "Monster",
        "Combat Area",
        "Area Level",
        "Max Life",
        "Damage",
        "Attack Rating",
        "Defense",
        "Experience",
      ],
      uniqueRows.map(({ area, areaLevel, unique }) => [
        unique.name,
        monsterTuning[unique.monster].name,
        area,
        areaLevel,
        ...numberCells(uniqueReport(unique.monster, unique.name, areaLevel)),
      ]),
    ),
  );
  console.log();
}

const bossArea = areas.find((area) => area.actBoss !== null);
if (bossArea?.actBoss && bossArea.areaLevel !== null) {
  const boss = bossReport(
    bossArea.actBoss.monster,
    bossArea.actBoss.name,
    bossArea.areaLevel,
  );
  const { gravefire: fire } = boss;
  console.log(
    `# Act Boss ${bossArea.actBoss.name} (${bossArea.name}, Area Level ${bossArea.areaLevel}), as a Unique Monster\n`,
  );
  console.log(
    table(
      ["Max Life", "Blow", "Attack Rating", "Defense", "Experience"],
      [
        [
          grouped(boss.maxLife),
          `${boss.damage[0]}–${boss.damage[1]}`,
          boss.attackRating,
          boss.defense,
          grouped(boss.experience),
        ],
      ],
    ),
  );
  console.log(
    `\nGravefire: range ${fire.range}, wind-up ${fire.windUpMs} ms, recovery ${fire.recoveryMs.join(" / ")} ms (first half / past half), radius ${fire.radius}, burns ${fire.burnMs} ms in ${fire.ticks} ticks of ${fire.tick[0]}–${fire.tick[1]} (${fire.tickMs} ms apart), ${fire.burn[0]}–${fire.burn[1]} if stood in throughout\n`,
  );
  console.log(
    table(
      [
        "Stage",
        "First wave s",
        "Every s",
        "Size",
        "Archers",
        "Limit",
        "Raised a min",
        "Gravefire every s",
      ],
      boss.stages.map((stage) => [
        stage.stage,
        stage.firstWaveS ?? "–",
        stage.everyS,
        stage.size,
        stage.archers,
        stage.limit,
        stage.perMinute.toFixed(1),
        stage.gravefireEveryS.toFixed(1),
      ]),
    ),
  );
  console.log();
}

const rows = skillReport(areas);
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
console.log(
  "# Skills: per Skill Level, every Synergy giver and Passive Skill at the same Skill Level\n",
);
console.log(
  table(
    [
      "Skill",
      "Hero Lvl",
      "Skill Lvl",
      "Mana",
      "Number",
      "Base",
      "+Synergies",
      "+Passive",
    ],
    rows.flatMap((row) =>
      row.numbers.map((n, i) => [
        i === 0 ? row.name : "",
        i === 0 ? row.requiredLevel : "",
        i === 0 ? row.skillLevel : "",
        i === 0 ? row.mana : "",
        n.label,
        num(n.base),
        num(n.withSynergies),
        num(n.withPassive),
      ]),
    ),
  ),
);
const killColumns = rows.find((row) => row.kills.length > 0)?.kills ?? [];
console.log(
  "\n# Skills: casts, with Synergies, to kill each Monster of each Combat Area\n",
);
console.log(
  table(
    [
      "Skill",
      "Skill Lvl",
      ...killColumns.map(
        (kill) =>
          `${kill.area} ${monsterTuning[kill.monster].name} (${kill.areaLevel})`,
      ),
    ],
    rows
      .filter((row) => row.kills.length > 0)
      .map((row) => [
        row.name,
        row.skillLevel,
        ...row.kills.map((kill) => kill.casts),
      ]),
  ),
);

const minionRows = minionReport();
const budgetText = `Skill Points earned: Hero Level - 1. Half go into Summoning (rounded down). Raise Skeleton takes ${RAISE_SKELETON_SHARE * 100}% of them (rounded up); the rest are spread evenly over the other open cast Skills (Raise Archer from Level ${skillTuning.raiseArcher.requiredLevel}; Raise Mage from Level ${skillTuning.raiseMage.requiredLevel}; Golem), odd points to Raise Archer, then Raise Mage, then Golem. A Raised Mage's Cold damage counts after the Skeleton's Cold Resistance. With Passive Skills, ${SUMMONING_PASSIVES.map(({ skill, share }) => `${skillTuning[skill].name} (open from Level ${skillTuning[skill].requiredLevel}) takes ${share * 100}%`).join(" and ")} of those other points first (at least one each), each rounded down, and the rest is spread as before. A kind with no Skill Level has no row. Synergies between the Summoning Skills count.`;
console.log(
  `\n# Minions: against an own-Level trash Skeleton, a full group of each kind\n\n${budgetText}\n`,
);
for (const [title, pick] of [
  ["base Summoning Skills alone", (row: MinionLevelRow) => row.base],
  ["with Passive Skills", (row: MinionLevelRow) => row.withPassive],
] as const) {
  console.log(`## ${title}\n`);
  console.log(
    table(
      [
        "Hero Lvl",
        "Points",
        "Skeleton Life",
        "Minion",
        "Skill Lvl",
        "Bonebinding",
        "Grave Command",
        "Count",
        "Life",
        "Attack Rating",
        "Chance to hit",
        "Mean hit",
        "Damage/s",
        "Group kills in s",
      ],
      minionRows.flatMap((row) =>
        pick(row).minions.map((minion, i) => [
          i === 0 ? row.heroLevel : "",
          i === 0 ? row.budget : "",
          i === 0 ? row.targetLife : "",
          minion.name,
          minion.skillLevel,
          pick(row).skillLevels.bonebinding ?? 0,
          pick(row).skillLevels.graveCommand ?? 0,
          minion.count,
          minion.life,
          minion.attackRating,
          `${(minion.chanceToHit * 100).toFixed(0)}%`,
          minion.meanHit.toFixed(1),
          minion.damagePerSecond.toFixed(1),
          minion.secondsToKill.toFixed(1),
        ]),
      ),
    ),
  );
  console.log(
    `\nAll kinds together kill one Skeleton in (s): ${minionRows
      .map(
        (row) =>
          `Level ${row.heroLevel} ${pick(row).allSecondsToKill?.toFixed(1) ?? "–"}`,
      )
      .join(", ")}`,
  );
  console.log();
}
