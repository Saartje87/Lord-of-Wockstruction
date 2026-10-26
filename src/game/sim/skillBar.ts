import type { Skill } from "../tuning/skills";

/** The Skill Bar's keyed slots, cast by keys 1–4 in turn. */
export const KEYED_SLOTS = ["key1", "key2", "key3", "key4"] as const;

/** One of the Skill Bar's keyed slots. */
export type KeyedSlot = (typeof KEYED_SLOTS)[number];

/** The Skill Bar's slots: the right mouse button's, then the keyed ones. */
export const SKILL_BAR_SLOTS = ["right", ...KEYED_SLOTS] as const;

/** One slot of the Skill Bar. */
export type SkillBarSlot = (typeof SKILL_BAR_SLOTS)[number];

/** The key that casts a keyed slot, as `KeyboardEvent.key`: "1" to "4". */
export function slotKey(slot: KeyedSlot): string {
  return String(KEYED_SLOTS.indexOf(slot) + 1);
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
 * The Skill Bar with `skill` put into `slot`, replacing whatever was there
 * and leaving empty the slot it was in, if any.
 */
export function putSkillOnBar(
  bar: SkillBar,
  skill: Skill,
  slot: SkillBarSlot,
): SkillBar {
  const moved = Object.fromEntries(
    SKILL_BAR_SLOTS.map((name) => [
      name,
      bar[name] === skill ? null : bar[name],
    ]),
  ) as SkillBar;
  return { ...moved, [slot]: skill };
}
