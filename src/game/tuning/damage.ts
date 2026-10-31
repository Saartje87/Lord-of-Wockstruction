import type { Bonus } from "./items";

/** Every Damage Type: Physical and the three Elements. */
export const DAMAGE_TYPES = ["physical", "fire", "cold", "lightning"] as const;

/** One kind of damage, which a hit carries an amount of. */
export type DamageType = (typeof DAMAGE_TYPES)[number];

/** The Elements: every Damage Type but Physical. */
export const ELEMENTS = ["fire", "cold", "lightning"] as const;

/** One of the Elements. */
export type Element = (typeof ELEMENTS)[number];

/**
 * Per Element: its display name and the Bonuses that guard against it
 * (`resistanceBonus`) and add flat damage of it (`damageBonus`).
 */
export const ELEMENT_INFO = {
  fire: {
    name: "Fire",
    resistanceBonus: "fireResistance",
    damageBonus: "fireDamage",
  },
  cold: {
    name: "Cold",
    resistanceBonus: "coldResistance",
    damageBonus: "coldDamage",
  },
  lightning: {
    name: "Lightning",
    resistanceBonus: "lightningResistance",
    damageBonus: "lightningDamage",
  },
} as const satisfies Record<
  Element,
  { name: string; resistanceBonus: Bonus; damageBonus: Bonus }
>;

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

/**
 * The Resistance Penalty of each Act, by Act number: a whole number of 0 or
 * more (percent) taken off every one of the Hero's Resistances, before the
 * cap, while they are in an Area of that Act. Act 1's is 0.
 */
export const RESISTANCE_PENALTIES: Record<number, number> = {
  1: 0,
};

/** The Resistance Penalty in an Area of `act`; none for an Act without one or an Area without an Act. */
export function resistancePenaltyOf(act: number | null): number {
  return act === null ? 0 : (RESISTANCE_PENALTIES[act] ?? 0);
}
