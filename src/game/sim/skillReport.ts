import type { MonsterType } from "../tuning/monsters";
import {
  type Branch,
  type CastSkill,
  castTuning,
  isPassive,
  type Skill,
  type SkillEffect,
} from "../tuning/skills";
import type { Area } from "./area";
import { monsterMaxLife } from "./monsters";
import { type SkillLineLabel, skillNumbers } from "./skillNumbers";
import { SKILLS, skillManaCost } from "./world";

/** One number of a Skill at a Skill Level, as Synergies and Passive Skills change it. */
export type SkillNumber = {
  label: SkillLineLabel;
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

/** The lines of `skillNumbers` the report shows, by kind of effect. */
const REPORTED: Record<SkillEffect["type"], SkillLineLabel[]> = {
  summon: ["Life", "Damage"],
  raise: ["Count", "Life", "Damage"],
  curse: ["Duration", "Radius"],
  ward: ["Soak"],
  wall: ["Piece Life"],
  projectile: ["Damage"],
  volley: ["Damage"],
  explode: [],
};

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
      const { effect } = tuning;
      const scenarios = [
        levelsOf([], 0),
        levelsOf(casts, skillLevel),
        levelsOf(SKILLS, skillLevel),
      ].map((levels) => skillNumbers(skill, skillLevel, levels));
      const numbers: SkillNumber[] = REPORTED[effect.type].flatMap((label) => {
        const [base, withSynergies, withPassive] = scenarios.map(
          (lines) => lines.find((one) => one.label === label)?.value,
        );
        return base === undefined ||
          withSynergies === undefined ||
          withPassive === undefined
          ? []
          : [{ label, base, withSynergies, withPassive }];
      });

      // What one cast deals a Monster, as a fraction of its Life if `share`.
      const hurts =
        effect.type === "projectile" ||
        effect.type === "volley" ||
        effect.type === "explode";
      const damageLine = hurts
        ? scenarios[1].find((one) => one.label === "Damage")
        : undefined;
      const share = effect.type === "explode";
      const hits = effect.type === "volley" ? SHARDS_HIT : 1;
      const dealtPerCast = damageLine ? damageLine.value * hits : null;
      const kills: SkillKill[] =
        dealtPerCast === null
          ? []
          : monstersByArea.map(({ area, areaLevel, monster }) => {
              const life = monsterMaxLife({
                type: monster,
                monsterLevel: areaLevel,
              });
              const dealt = dealtPerCast * (share ? life : 1);
              return {
                area,
                areaLevel,
                monster,
                casts: Math.ceil(life / dealt),
              };
            });
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
