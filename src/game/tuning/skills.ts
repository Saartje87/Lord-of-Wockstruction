/** Skill tuning, in human units. The sim converts it to steps once. */
export type SkillTuning = {
  /** Shown in the Skill Tree. */
  name: string;
  /** The Hero's Level from which a Skill Point can be spent on it. */
  requiredLevel: number;
  /** The Mana a cast costs at Skill Level 1. */
  manaCost: number;
  /** The Mana cost added by each Skill Level past the first. */
  manaCostPerSkillLevel: number;
  /** How long a cast roots the Hero (ms). */
  castMs: number;
};

/** One of the Skills, by the name the sim and the Save know it by. */
export type Skill = "golem";

/** Every Skill's tuning. */
export const skillTuning: Record<Skill, SkillTuning> = {
  // Diablo 2's Clay Golem.
  golem: {
    name: "Golem",
    requiredLevel: 1,
    manaCost: 15,
    manaCostPerSkillLevel: 2,
    castMs: 400,
  },
};
