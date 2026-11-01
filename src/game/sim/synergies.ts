import {
  type CastSkill,
  PASSIVE_SKILLS,
  type Skill,
  skillTuning,
} from "../tuning/skills";

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

/**
 * What a Passive Skill multiplies a cast Skill's main number by, apart from
 * its Synergies: 1 plus, for each learned Passive Skill that boosts `skill`,
 * the tuned percent times its Skill Level.
 */
export function passiveMultiplier(
  skillLevels: Record<Skill, number>,
  skill: CastSkill,
): number {
  let multiplier = 1;
  for (const passive of PASSIVE_SKILLS) {
    const { boosts, percentPerSkillLevel } = skillTuning[passive].passive;
    if (boosts.includes(skill)) {
      multiplier += (percentPerSkillLevel / 100) * skillLevels[passive];
    }
  }
  return multiplier;
}

/**
 * What a cast Skill's main number is multiplied by in all: its Synergies and
 * its Passive Skills, the two as separate factors.
 */
export function skillPower(
  skillLevels: Record<Skill, number>,
  skill: CastSkill,
): number {
  return (
    synergyMultiplier(skillLevels, skill) *
    passiveMultiplier(skillLevels, skill)
  );
}

/**
 * What the learned Passive Skills multiply the hit damage and the Attack
 * Rating of a Minion Skill's Minions by, apart from their Life: 1 plus, for
 * each that boosts `skill`, its tuned percent times its Skill Level.
 */
export function minionBonuses(
  skillLevels: Record<Skill, number>,
  skill: CastSkill,
): { damageBonus: number; attackRatingBonus: number } {
  let damageBonus = 1;
  let attackRatingBonus = 1;
  for (const passive of PASSIVE_SKILLS) {
    const effect = skillTuning[passive].passive;
    if (!effect.boosts.includes(skill)) continue;
    const level = skillLevels[passive];
    damageBonus += ((effect.damagePercentPerSkillLevel ?? 0) / 100) * level;
    attackRatingBonus +=
      ((effect.attackRatingPercentPerSkillLevel ?? 0) / 100) * level;
  }
  return { damageBonus, attackRatingBonus };
}
