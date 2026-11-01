import { heroTuning } from "../tuning/hero";
import { type MinionType, minionTuning } from "../tuning/minions";
import {
  type CastSkill,
  castTuning,
  type Skill,
  skillTuning,
} from "../tuning/skills";
import {
  minionAttackRating,
  minionDamageRange,
  minionMaxLife,
} from "./minions";
import { monsterDefense, monsterMaxLife } from "./monsters";
import { minionBonuses, skillPower } from "./synergies";
import { chanceToHit, raiseCount, SKILLS } from "./world";

/** The Hero Levels `minionReport` covers when none are asked for. */
export const MINION_REPORT_LEVELS = [4, 8, 12, 16, 20];

/** The Summoning Skills whose Minions the report covers, in the order spare points go to them. */
export const SUMMONING_SKILLS: CastSkill[] = [
  "raiseSkeleton",
  "golem",
  "raiseArcher",
];

/**
 * The Passive Skills the "with Passive Skills" case puts points in, each
 * taking its `share` of the Summoning budget (rounded down) once the Hero's
 * Level has opened it.
 */
export const SUMMONING_PASSIVES = [
  { skill: "bonebinding", share: 0.4 },
  { skill: "graveCommand", share: 0.2 },
] as const;

/** The Monster the Minions are measured against: a trash Skeleton of the Hero's own Level. */
export const REPORT_TARGET = "skeleton" as const;

/** One Minion kind's numbers against an own-Level trash Skeleton. */
export type MinionRow = {
  skill: CastSkill;
  name: string;
  skillLevel: number;
  /** How many of the kind the Hero has at once. */
  count: number;
  life: number;
  attackRating: number;
  /** The chance one of its attacks hits the Skeleton. */
  chanceToHit: number;
  /** The mean damage of one hit. */
  meanHit: number;
  /** Damage a second by one Minion, misses counted. */
  damagePerSecond: number;
  /** Seconds a full group of the kind takes to kill one Skeleton. */
  secondsToKill: number;
};

/** The Minions of one allocation of the budget. */
export type MinionCase = {
  /** Skill Levels given, by Skill (Skills left out have none). */
  skillLevels: Partial<Record<Skill, number>>;
  minions: MinionRow[];
  /** Seconds all the kinds together take to kill one Skeleton; null with none. */
  allSecondsToKill: number | null;
};

/** One Hero Level's budget and its two cases. */
export type MinionLevelRow = {
  heroLevel: number;
  /** The Skill Points the Hero has earned by this Level. */
  skillPoints: number;
  /** The Skill Points put into Summoning: about half of `skillPoints`. */
  budget: number;
  /** An own-Level trash Skeleton's Life. */
  targetLife: number;
  /** The base Summoning Skills alone. */
  base: MinionCase;
  /** With Bonebinding and Grave Command at their budgeted Skill Levels. */
  withPassive: MinionCase;
};

/** The Skill Points a Hero of `heroLevel` has earned in all. */
export function skillPointsAt(heroLevel: number): number {
  return (heroLevel - 1) * heroTuning.skillPointsPerLevel;
}

/** The Skill Points of Summoning at `heroLevel`: half of all, rounded down. */
export function summoningBudget(heroLevel: number): number {
  return Math.floor(skillPointsAt(heroLevel) / 2);
}

/**
 * Spreads `budget` points over the Summoning Skills the Hero's Level has open
 * (evenly, the odd points going to them in `SUMMONING_SKILLS` order). With
 * `withPassive` the open Passive Skills take their shares first, and the
 * Hero, having chosen the Raised Skeletons they boost, puts the rest into
 * Raise Skeleton alone.
 */
function allocate(
  heroLevel: number,
  budget: number,
  withPassive: boolean,
): Partial<Record<Skill, number>> {
  const levels: Partial<Record<Skill, number>> = {};
  let cast = budget;
  if (withPassive) {
    for (const { skill, share } of SUMMONING_PASSIVES) {
      if (skillTuning[skill].requiredLevel > heroLevel) continue;
      const points = Math.min(
        cast - 1,
        Math.max(1, Math.floor(budget * share)),
      );
      if (points <= 0) continue;
      levels[skill] = points;
      cast -= points;
    }
  }
  const open = SUMMONING_SKILLS.filter(
    (skill) =>
      skillTuning[skill].requiredLevel <= heroLevel &&
      (!withPassive || skill === "raiseSkeleton"),
  );
  open.forEach((skill, i) => {
    const level =
      Math.floor(cast / open.length) + (i < cast % open.length ? 1 : 0);
    if (level > 0) levels[skill] = level;
  });
  return levels;
}

/** Seconds from one attack's start to the next, from the Minion's tuning. */
function swingSeconds(minion: MinionType): number {
  const { windUpMs, rootMs, recoveryMs } = minionTuning[minion];
  return (windUpMs + rootMs + recoveryMs) / 1000;
}

/** The Minions of `skillLevels` against a trash Skeleton of `heroLevel`. */
function minionCase(
  heroLevel: number,
  skillLevels: Partial<Record<Skill, number>>,
): MinionCase {
  const all = Object.fromEntries(
    SKILLS.map((skill) => [skill, skillLevels[skill] ?? 0]),
  ) as Record<Skill, number>;
  const target = { type: REPORT_TARGET, monsterLevel: heroLevel };
  const defense = monsterDefense(target);
  const targetLife = monsterMaxLife(target);
  const minions = SUMMONING_SKILLS.flatMap((skill): MinionRow[] => {
    const skillLevel = skillLevels[skill] ?? 0;
    if (skillLevel === 0) return [];
    const { effect, name } = castTuning(skill);
    if (effect.type !== "summon" && effect.type !== "raise") return [];
    const minion = {
      type: effect.minion,
      skillLevel,
      synergy: skillPower(all, skill),
      ...minionBonuses(all, skill),
    };
    const count = effect.type === "raise" ? raiseCount(effect, skillLevel) : 1;
    const attackRating = minionAttackRating(minion);
    const chance = chanceToHit(attackRating, defense);
    const [least, most] = minionDamageRange(minion);
    const meanHit = (least + most) / 2;
    const damagePerSecond = (chance * meanHit) / swingSeconds(effect.minion);
    return [
      {
        skill,
        name,
        skillLevel,
        count,
        life: minionMaxLife(minion),
        attackRating,
        chanceToHit: chance,
        meanHit,
        damagePerSecond,
        secondsToKill: targetLife / (damagePerSecond * count),
      },
    ];
  });
  const perSecond = minions.reduce(
    (sum, one) => sum + one.damagePerSecond * one.count,
    0,
  );
  return {
    skillLevels,
    minions,
    allSecondsToKill: perSecond > 0 ? targetLife / perSecond : null,
  };
}

/**
 * How the Hero's Minions fare against a trash Skeleton of the Hero's own
 * Level at each of `heroLevels`, worked out by the sim's own functions and
 * the live tuning. The Skill Levels follow one budget: of the Skill Points
 * earned (`skillPointsAt`), half go into Summoning (`summoningBudget`). The
 * base case spreads them evenly over the open cast Summoning Skills; the
 * Passive case gives each of `SUMMONING_PASSIVES` its share (rounded down, at least a point),
 * once it is open and a point is left over for Raise Skeleton, and puts the rest into it.
 * Levels past the highest Area Level are projected from the formulas.
 */
export function minionReport(
  heroLevels: number[] = MINION_REPORT_LEVELS,
): MinionLevelRow[] {
  return heroLevels.map((heroLevel) => {
    const budget = summoningBudget(heroLevel);
    return {
      heroLevel,
      skillPoints: skillPointsAt(heroLevel),
      budget,
      targetLife: monsterMaxLife({
        type: REPORT_TARGET,
        monsterLevel: heroLevel,
      }),
      base: minionCase(heroLevel, allocate(heroLevel, budget, false)),
      withPassive: minionCase(heroLevel, allocate(heroLevel, budget, true)),
    };
  });
}
