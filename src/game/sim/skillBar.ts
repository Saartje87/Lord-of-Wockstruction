import type { Skill } from "../tuning/skills";

/** The Skill Bar's slots: the right mouse button's, then keys 1–4's. */
export const SKILL_BAR_SLOTS = [
  "right",
  "key1",
  "key2",
  "key3",
  "key4",
] as const;

/** One slot of the Skill Bar. */
export type SkillBarSlot = (typeof SKILL_BAR_SLOTS)[number];

/** The Skill in each slot of the Skill Bar, or null for an empty one. */
export type SkillBar = Record<SkillBarSlot, Skill | null>;

/** A Skill Bar with every slot empty, as a New Hero has. */
export function emptySkillBar(): SkillBar {
  return { right: null, key1: null, key2: null, key3: null, key4: null };
}

/**
 * The Skill Bar with a newly learned Skill put in it: into the right-click
 * slot if empty, else the first empty keyed slot, else nowhere.
 */
export function placeLearnedSkill(bar: SkillBar, skill: Skill): SkillBar {
  const empty = SKILL_BAR_SLOTS.find((slot) => bar[slot] === null);
  return empty ? { ...bar, [empty]: skill } : { ...bar };
}
