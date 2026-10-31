/** The Smith's one-time service: the bonuses it can give, by the kind of Item. */

import type { Bonus, ItemKind } from "./items";

/**
 * The pool the Smith rolls from for an Item of `kind`: the Armour pool also
 * serves Helms, Gloves, Boots and Shields. Null for a kind he can't work.
 */
export function smithPoolOf(
  kind: ItemKind,
): "weapon" | "armour" | "wand" | null {
  if (kind === "weapon") return "weapon";
  if (kind === "wand") return "wand";
  const armour: readonly ItemKind[] = [
    "armour",
    "helm",
    "gloves",
    "boots",
    "shield",
  ];
  return armour.includes(kind) ? "armour" : null;
}

/**
 * One bonus the Smith can give and the `[min, max]` amount it rolls. A
 * `skillLevel` bonus is for a random Skill, picked as he gives it.
 */
export type SmithPoolEntry = { bonus: Bonus; amount: [number, number] };

/**
 * The pools the Smith rolls a bonus from, by Item kind: the Armour pool also serves
 * Helms, Gloves, Boots and Shields, and a Wand has a pool of its own.
 */
export const smithTuning: {
  weapon: SmithPoolEntry[];
  armour: SmithPoolEntry[];
  wand: SmithPoolEntry[];
} = {
  weapon: [
    { bonus: "strength", amount: [3, 6] },
    { bonus: "dexterity", amount: [3, 6] },
    { bonus: "attackRating", amount: [20, 40] },
  ],
  armour: [
    { bonus: "vitality", amount: [3, 6] },
    { bonus: "life", amount: [15, 30] },
    { bonus: "defense", amount: [10, 20] },
  ],
  wand: [
    { bonus: "mana", amount: [10, 20] },
    { bonus: "energy", amount: [3, 6] },
    { bonus: "skillLevel", amount: [1, 1] },
  ],
};
