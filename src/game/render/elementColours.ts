import type { Element } from "../tuning/damage";

/**
 * What each Element is drawn in wherever it shows: a damage number's tint,
 * a Resistance line on the Hero panel and an Affix line on a tooltip. Fire
 * orange on numbers, Fire red on the Hero panel's line, as the spec has it.
 */
export const ELEMENT_COLOUR: Record<Element, number> = {
  fire: 0xff8a2a,
  cold: 0x4aa8ff,
  lightning: 0xffee3a,
};

/** The Hero panel's Resistance line colours: the Element colours, but Fire red. */
export const RESISTANCE_LINE_COLOUR: Record<Element, number> = {
  ...ELEMENT_COLOUR,
  fire: 0xff5a4a,
};
