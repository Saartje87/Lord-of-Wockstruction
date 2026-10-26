import type { Skill } from "../tuning/skills";

/** The Skill Bar's keyed slots, cast by keys Q, W, E and R in turn. */
export const KEYED_SLOTS = ["key1", "key2", "key3", "key4"] as const;

/** One of the Skill Bar's keyed slots. */
export type KeyedSlot = (typeof KEYED_SLOTS)[number];

/** The Skill Bar's slots: the right mouse button's, then the keyed ones. */
export const SKILL_BAR_SLOTS = ["right", ...KEYED_SLOTS] as const;

/** One slot of the Skill Bar. */
export type SkillBarSlot = (typeof SKILL_BAR_SLOTS)[number];

/** The keys that cast the keyed slots, in turn. */
const SLOT_KEYS = ["Q", "W", "E", "R"] as const;

/** The key that casts a keyed slot, upper case: "Q", "W", "E" or "R". */
export function slotKey(slot: KeyedSlot): string {
  return SLOT_KEYS[KEYED_SLOTS.indexOf(slot)];
}

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

/**
 * The Skill Bar with `skill` put into `slot`. The Skill it displaces from
 * `slot` goes into the slot `skill` was in, if it was on the bar, and
 * otherwise falls off the bar. A Skill is never in two slots.
 */
export function putSkillOnBar(
  bar: SkillBar,
  skill: Skill,
  slot: SkillBarSlot,
): SkillBar {
  const from = SKILL_BAR_SLOTS.find((name) => bar[name] === skill);
  const displaced = bar[slot];
  return {
    ...bar,
    ...(from ? { [from]: displaced } : {}),
    [slot]: skill,
  };
}
