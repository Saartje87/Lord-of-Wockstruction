/** The Smith's one-time service: the bonuses it can give, by the kind of Item. */

import type { Bonus } from "./items";

/** One bonus the Smith can give and the `[min, max]` amount it rolls. */
export type SmithPoolEntry = { bonus: Bonus; amount: [number, number] };

/**
 * The pools the Smith rolls a bonus from, by Item kind: only a Weapon and an
 * Armour can be worked.
 */
export const smithTuning: {
  weapon: SmithPoolEntry[];
  armour: SmithPoolEntry[];
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
};
