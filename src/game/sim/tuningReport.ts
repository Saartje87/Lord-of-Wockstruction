import { goldTuning } from "../tuning/gold";
import type { MonsterType } from "../tuning/monsters";
import type { Area } from "./area";
import {
  killExperience,
  monsterAttackRating,
  monsterDamageRange,
  monsterDefense,
  monsterExperience,
  monsterMaxLife,
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
