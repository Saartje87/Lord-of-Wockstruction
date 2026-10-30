import { type Skill, skillTuning } from "../tuning/skills";

/**
 * What multiplies a cast Skill's main number: 1 plus, for each of its
 * Synergies, the tuned percent times the giving Skill's Skill Level in
 * `skillLevels`, however that level was gained and wherever the giver is
 * (the Skill Bar included or not).
 */
export function synergyMultiplier(
  skillLevels: Record<Skill, number>,
  skill: Skill,
): number {
  let multiplier = 1;
  for (const { skill: giver, percentPerSkillLevel } of skillTuning[skill]
    .synergies) {
    multiplier += (percentPerSkillLevel / 100) * skillLevels[giver];
  }
  return multiplier;
}
