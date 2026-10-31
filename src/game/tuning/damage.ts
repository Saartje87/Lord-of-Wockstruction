/** Every Damage Type: Physical and the three Elements. */
export const DAMAGE_TYPES = ["physical", "fire", "cold", "lightning"] as const;

/** One kind of damage, which a hit carries an amount of. */
export type DamageType = (typeof DAMAGE_TYPES)[number];

/** The Elements: every Damage Type but Physical. */
export const ELEMENTS = ["fire", "cold", "lightning"] as const;

export type Element = (typeof ELEMENTS)[number];

/**
 * How a hit's damage splits over Damage Types, each a share of the whole;
 * they add up to 1. A missing type has no share, and a hit with no shares
 * at all is all Physical.
 */
export type DamageShares = Partial<Record<DamageType, number>>;

/**
 * A Resistance per Element, in percent of that Element's damage shrugged off:
 * negative adds to it. A missing one is 0; each must be below 100.
 */
export type Resistances = Partial<Record<Element, number>>;

/**
 * The most Resistance takes off a hit (percent). The Hero's total can sit
 * above it, to be eaten into by a Resistance Penalty first.
 */
export const MAXIMUM_RESISTANCE = 75;

/** The least the Hero's effective Resistance goes (percent): hits take double. */
export const MINIMUM_RESISTANCE = -100;
