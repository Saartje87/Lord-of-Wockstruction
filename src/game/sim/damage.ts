import {
  DAMAGE_TYPES,
  type DamageShares,
  type DamageType,
  ELEMENTS,
  type Resistances,
} from "../tuning/damage";
import { type MinionType, minionTuning } from "../tuning/minions";
import { type MonsterType, monsterTuning } from "../tuning/monsters";

/**
 * A hit's damage as an amount per Damage Type, a missing one being 0. Left
 * unrounded: a hit rounds once, when it lands.
 */
export type Damage = Partial<Record<DamageType, number>>;

/**
 * A rolled whole-number `amount` of damage split over Damage Types by
 * `shares`, or all Physical with none.
 */
export function splitDamage(amount: number, shares?: DamageShares): Damage {
  if (!shares) return { physical: amount };
  const damage: Damage = {};
  for (const type of DAMAGE_TYPES) {
    const share = shares[type];
    if (share) damage[type] = amount * share;
  }
  return damage;
}

/** What a landed hit does: the Life it takes and what it is mostly made of. */
export type Landed = {
  /** The one total, whole, after Resistance and the multiplier. */
  total: number;
  /** The Damage Type of the largest amount landed; ties go in `DAMAGE_TYPES` order. */
  main: DamageType;
};

/**
 * Lands `damage` on someone with `resistances`: each Element scaled by
 * `1 - Resistance / 100`, Physical untouched, then the sum times `multiplier`
 * (a Curse's damage-taken), rounded once.
 */
export function landDamage(
  damage: Damage,
  resistances: Resistances = {},
  multiplier = 1,
): Landed {
  let sum = damage.physical ?? 0;
  let main: DamageType = "physical";
  let most = sum;
  for (const element of ELEMENTS) {
    const amount =
      (damage[element] ?? 0) * (1 - (resistances[element] ?? 0) / 100);
    sum += amount;
    if (amount > most) {
      most = amount;
      main = element;
    }
  }
  return { total: Math.round(sum * multiplier), main };
}

/** A hit's whole damage with no Resistance, for what has none to give. */
export function unresistedTotal(damage: Damage): number {
  return landDamage(damage).total;
}

/** What a Monster of `type` shrugs off. */
export function monsterResistances(type: MonsterType): Resistances {
  return monsterTuning[type].resistances ?? {};
}

/** What a Minion of `type` shrugs off: its Monster's, for a Raised one. */
export function minionResistances(type: MinionType): Resistances {
  const tuning = minionTuning[type];
  return tuning.resistancesOf
    ? monsterResistances(tuning.resistancesOf)
    : (tuning.resistances ?? {});
}
