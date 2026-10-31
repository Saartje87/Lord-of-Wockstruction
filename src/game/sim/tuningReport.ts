import { goldTuning } from "../tuning/gold";
import { graveWockingtonTuning } from "../tuning/graveWockington";
import { type MonsterType, monsterTuning } from "../tuning/monsters";
import type { Area } from "./area";
import {
  killExperience,
  monsterAttackRating,
  monsterDamageRange,
  monsterDefense,
  monsterExperience,
  monsterMaxLife,
  shareOfRange,
} from "./monsters";
import { levelExperience, nextLevelExperience } from "./world";

/** How fast a Hero Level goes against Monsters of the Hero's own Level. */
export type LevelRow = {
  level: number;
  /** The Experience from this Level to the next. */
  toNext: number;
  /** The Experience a kill of an own-Level Monster gains. */
  killExperience: number;
  /** How many such kills reach the next Level. */
  kills: number;
  /**
   * The Gold those kills drop, at the Monster Level of the Area the Hero plays
   * in at this Level; null when no Area places the type.
   */
  gold: LevelGold | null;
};

/** The Gold a Hero Level's kills drop. */
export type LevelGold = {
  /** The Area Level played at: the deepest at or below the Hero Level. */
  areaLevel: number;
  /** The expected Gold of one kill there: Gold Pile chance times mean amount. */
  perKill: number;
  /** `perKill` times the kills the Level takes. */
  total: number;
};

/** A Monster type's numbers in one Combat Area. */
export type AreaRow = {
  area: string;
  areaLevel: number;
  maxLife: number;
  damage: [number, number];
  attackRating: number;
  defense: number;
  experience: number;
};

/** A Monster type's numbers per Hero Level and per Combat Area. */
export type TuningReport = { levels: LevelRow[]; areas: AreaRow[] };

/**
 * A Monster type's numbers from the live tuning, worked out by the sim's own
 * functions: for each Hero Level below the cap, the kills of own-Level
 * Monsters it takes and the Gold they drop, and for each of `areas` with an Area Level that places
 * the type, the Monster there, by Area Level. Town, with none, is left out.
 */
export function tuningReport(
  type: MonsterType,
  areas: Pick<Area, "name" | "areaLevel" | "spawns">[],
): TuningReport {
  const playedLevels = areas
    .flatMap(({ areaLevel, spawns }) =>
      areaLevel !== null && spawns.some((spawn) => spawn.monster === type)
        ? [areaLevel]
        : [],
    )
    .sort((a, b) => a - b);
  const [least, most] = goldTuning.perMonsterLevel;
  const goldPerMonsterLevel = (goldTuning.chance * (least + most)) / 2;

  const levels: LevelRow[] = [];
  for (let level = 1; ; level++) {
    const next = nextLevelExperience(level);
    if (next === null) break;
    const toNext = next - levelExperience(level);
    const experience = killExperience({ type, monsterLevel: level }, level);
    const kills = Math.ceil(toNext / experience);
    const areaLevel =
      playedLevels.findLast((areaLevel) => areaLevel <= level) ??
      playedLevels[0];
    const perKill = goldPerMonsterLevel * areaLevel;
    levels.push({
      level,
      toNext,
      killExperience: experience,
      kills,
      gold:
        areaLevel === undefined
          ? null
          : { areaLevel, perKill, total: perKill * kills },
    });
  }

  const areaRows = areas
    .flatMap(({ name, areaLevel, spawns }) => {
      if (areaLevel === null) return [];
      if (!spawns.some((spawn) => spawn.monster === type)) return [];
      const monster = { type, monsterLevel: areaLevel };
      return [
        {
          area: name,
          areaLevel,
          maxLife: monsterMaxLife(monster),
          damage: monsterDamageRange(monster),
          attackRating: monsterAttackRating(monster),
          defense: monsterDefense(monster),
          experience: monsterExperience(monster),
        },
      ];
    })
    .sort((a, b) => a.areaLevel - b.areaLevel);

  return { levels, areas: areaRows };
}

/** One stage of the Act Boss's waves. */
export type BossStage = {
  stage: "first half" | "past half";
  /** Seconds until the first wave, after he first goes after the Hero. */
  firstWaveS: number | null;
  /** Seconds between waves. */
  everyS: number;
  size: number;
  archers: number;
  /** How many raised Monsters can live at once. */
  limit: number;
  /** Raised Monsters a minute. */
  perMinute: number;
  /** Seconds between Gravefire casts at best (wind-up plus recovery). */
  gravefireEveryS: number;
};

/** A Unique Monster's numbers at an Area Level, Unique multipliers included. */
export type UniqueRow = {
  maxLife: number;
  damage: [number, number];
  attackRating: number;
  defense: number;
  experience: number;
};

/** The Monster `type` as the Unique Monster `name` at `areaLevel`, from the live tuning. */
export function uniqueReport(
  type: MonsterType,
  name: string,
  areaLevel: number,
): UniqueRow {
  const monster = { type, monsterLevel: areaLevel, unique: name };
  return {
    maxLife: monsterMaxLife(monster),
    damage: monsterDamageRange(monster),
    attackRating: monsterAttackRating(monster),
    defense: monsterDefense(monster),
    experience: monsterExperience(monster),
  };
}

/**
 * The Act Boss's numbers at an Area Level, Unique multipliers included (his
 * Life with his own, `graveWockingtonTuning.life`); the
 * `damage` is his melee blow.
 */
export type BossReport = UniqueRow & {
  gravefire: {
    range: number;
    windUpMs: number;
    recoveryMs: number[];
    radius: number;
    burnMs: number;
    tickMs: number;
    ticks: number;
    /** One tick's damage, before Resistances and Defense. */
    tick: [number, number];
    /** All ticks of one circle, if stood in throughout. */
    burn: [number, number];
  };
  stages: BossStage[];
};

/**
 * The Act Boss `type` as a Unique Monster at `areaLevel`: his Life, blow,
 * Gravefire and waves per stage, from the live tuning.
 */
export function bossReport(
  type: MonsterType,
  name: string,
  areaLevel: number,
): BossReport {
  const numbers = uniqueReport(type, name, areaLevel);
  const tuning = monsterTuning[type];
  const { attack } = tuning;
  if (attack.kind !== "ranged" || !attack.lob?.burn) {
    throw new Error(`${type} has no Gravefire`);
  }
  const { burn } = attack.lob;
  const tick = shareOfRange(numbers.damage, burn.damage);
  const ticks = Math.floor(burn.burnMs / burn.tickMs);
  const recoveries = attack.recoveryMs ?? [tuning.recoveryMs];
  const wave = graveWockingtonTuning;
  const waveStages = [
    { stage: "first half" as const, ...wave, archers: 0 },
    { stage: "past half" as const, ...wave, ...wave.pastHalf },
  ];
  return {
    ...numbers,
    gravefire: {
      range: attack.range,
      windUpMs: tuning.windUpMs,
      recoveryMs: recoveries,
      radius: attack.lob.radius,
      burnMs: burn.burnMs,
      tickMs: burn.tickMs,
      ticks,
      tick,
      burn: [tick[0] * ticks, tick[1] * ticks],
    },
    stages: waveStages.map((stage, i) => ({
      stage: stage.stage,
      firstWaveS: i === 0 ? wave.firstWaveMs / 1000 : null,
      everyS: stage.waveEveryMs / 1000,
      size: stage.waveSize,
      archers: stage.archers,
      limit: stage.raisedLimit,
      perMinute: (60_000 / stage.waveEveryMs) * stage.waveSize,
      gravefireEveryS:
        (tuning.windUpMs + (recoveries[i] ?? recoveries.at(-1) ?? 0)) / 1000,
    })),
  };
}
