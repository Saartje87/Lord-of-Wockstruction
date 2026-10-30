/**
 * The colour Gold is drawn in, on a Gold Pile's label and in the Inventory
 * panel: a coin gold, apart from every Rarity's colour.
 */
export const GOLD_COLOUR = 0xf2c230;

/** The colour a Value is drawn in on a tooltip when the Hero can't afford it. */
export const UNAFFORDABLE_COLOUR = 0xe05040;

/** A Gold Pile's ground label: "<amount> Gold". */
export function goldPileLabel(amount: number): string {
  return `${amount} Gold`;
}

/** The Hero's Gold as the Inventory panel shows it. */
export function goldTotalLabel(gold: number): string {
  return `${gold} Gold`;
}
