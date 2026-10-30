import type { MonsterType } from "../tuning/monsters";
import {
  type Branch,
  type CastSkill,
  castTuning,
  isPassive,
  type Skill,
} from "../tuning/skills";
import type { Area } from "./area";
import { minionDamageRange, minionMaxLife } from "./minions";
import { monsterMaxLife } from "./monsters";
import { passiveMultiplier, synergyMultiplier } from "./synergies";
import { STEP_MS } from "./units";
import {
  curseRadius,
  curseSteps,
  projectileDamage,
  raiseCount,
  SKILLS,
  skillManaCost,
  wardAmount,
} from "./world";

/** One number of a Skill at a Skill Level, as Synergies and Passive Skills change it. */
export type SkillNumber = {
  label: string;
  /** With no Synergy giver or Passive Skill Level. */
  base: number;
  /** With every Synergy giver at the same Skill Level. */
  withSynergies: number;
  /** With the Passive Skills that boost it at that Skill Level as well. */
  withPassive: number;
};

/** The casts a Skill takes to kill a Monster of one kind in a Combat Area. */
export type SkillKill = {
  area: string;
  areaLevel: number;
  monster: MonsterType;
  casts: number;
};

/** A cast Skill at one Skill Level. */
export type SkillRow = {
  skill: CastSkill;
  name: string;
  branch: Branch;
  requiredLevel: number;
  skillLevel: number;
  mana: number;
  numbers: SkillNumber[];
  /** Empty for a Skill that deals no damage to Monsters. */
  kills: SkillKill[];
};

/**
 * How many shards of a Splinter Volley's fan a Monster takes in a typical
 * fight: up close several land, far off one or two.
 */
const SHARDS_HIT = 2;

/** The Skill Levels `skillReport` covers when none are asked for. */
export const REPORT_SKILL_LEVELS = [1, 5, 10, 20];

/** What multiplies a Skill's numbers: its Synergies, and its Passive Skills. */
type Power = { synergy: number; passive: number };

/** What a Power multiplies a Skill's main number by in all. */
function strength(power: Power): number {
  return power.synergy * power.passive;
}

/** Skill Levels of `level` in each of `skills`, and 0 in every other Skill. */
function levelsOf(skills: readonly Skill[], level: number) {
  const levels = Object.fromEntries(
    SKILLS.map((skill) => [skill, 0]),
  ) as Record<Skill, number>;
  for (const skill of skills) levels[skill] = level;
  return levels;
}

/**
 * Each cast Skill's numbers from the live tuning at each of `skillLevels`,
 * worked out by the sim's own functions, with what Synergies (every giver at
 * the same Skill Level) and Passive Skills (at that Skill Level too) add.
 * For a Skill that damages Monsters, also the casts it takes, with
 * Synergies, to kill each kind of Monster each of `areas` places, by Area
 * Level.
 */
export function skillReport(
  areas: Pick<Area, "name" | "areaLevel" | "spawns">[],
  skillLevels: number[] = REPORT_SKILL_LEVELS,
): SkillRow[] {
  const monstersByArea = areas
    .flatMap(({ name, areaLevel, spawns }) =>
      areaLevel === null
        ? []
        : [...new Set(spawns.map((spawn) => spawn.monster))].map((monster) => ({
            area: name,
            areaLevel,
            monster,
          })),
    )
    .sort((a, b) => a.areaLevel - b.areaLevel);
  const casts = SKILLS.filter((skill): skill is CastSkill => !isPassive(skill));

  return casts.flatMap((skill) =>
    skillLevels.map((skillLevel): SkillRow => {
      const tuning = castTuning(skill);
      const synergy = synergyMultiplier(levelsOf(casts, skillLevel), skill);
      const passive = passiveMultiplier(levelsOf(SKILLS, skillLevel), skill);
      const scenarios: Power[] = [
        { synergy: 1, passive: 1 },
        { synergy, passive: 1 },
        { synergy, passive },
      ];
      const numbers: SkillNumber[] = [];
      /** A number worked out in each scenario. */
      const add = (label: string, number: (power: Power) => number) => {
        const [base, withSynergies, withPassive] = scenarios.map(number);
        numbers.push({ label, base, withSynergies, withPassive });
      };
      /** A number that no Synergy or Passive Skill changes. */
      const addConstant = (label: string, value: number) =>
        add(label, () => value);
      /** What one cast deals a Monster, as a fraction of its Life if `share`. */
      let perCast: ((power: Power) => number) | null = null;
      let share = false;
      const { effect } = tuning;
      switch (effect.type) {
        case "summon":
        case "raise": {
          const { minion } = effect;
          if (effect.type === "raise") {
            const count = raiseCount(effect, skillLevel);
            addConstant("Count", count);
          }
          const minionAt = (power: Power) => ({
            type: minion,
            skillLevel,
            synergy: strength(power),
          });
          add("Life", (power) => minionMaxLife(minionAt(power)));
          add("Damage", (power) => {
            const [least, most] = minionDamageRange(minionAt(power));
            return (least + most) / 2;
          });
          break;
        }
        case "curse":
          add(
            "Duration",
            (power) =>
              (curseSteps(effect, skillLevel, strength(power)) * STEP_MS) /
              1000,
          );
          add("Radius", (power) =>
            curseRadius(effect, skillLevel, power.passive),
          );
          break;
        case "ward":
          add("Soak", (power) =>
            wardAmount(effect, skillLevel, strength(power)),
          );
          break;
        case "wall":
          addConstant("Piece Life", effect.pieceLife);
          break;
        case "projectile":
        case "volley": {
          const hits = effect.type === "volley" ? SHARDS_HIT : 1;
          const perHit = (power: Power) => {
            const [least, most] = projectileDamage(
              effect,
              skillLevel,
              strength(power),
            );
            return (least + most) / 2;
          };
          add("Damage", perHit);
          perCast = (power) => perHit(power) * hits;
          break;
        }
        case "explode":
          // A burst is a share of the dead Monster's own Life.
          share = true;
          perCast = (power) =>
            ((effect.share[0] + effect.share[1]) / 2) * strength(power);
          break;
      }

      const damage = perCast as ((power: Power) => number) | null;
      const kills: SkillKill[] = damage
        ? monstersByArea.map(({ area, areaLevel, monster }) => {
            const life = monsterMaxLife({
              type: monster,
              monsterLevel: areaLevel,
            });
            const dealt = damage(scenarios[1]) * (share ? life : 1);
            return { area, areaLevel, monster, casts: Math.ceil(life / dealt) };
          })
        : [];
      return {
        skill,
        name: tuning.name,
        branch: tuning.branch,
        requiredLevel: tuning.requiredLevel,
        skillLevel,
        mana: skillManaCost(skill, skillLevel),
        numbers,
        kills,
      };
    }),
  );
}
