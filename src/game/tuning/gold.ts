/**
 * Gold Piles: what a dying Monster may leave, rolled apart from its Item and
 * Potion drops.
 */
export const goldTuning: {
  /** The odds a kill drops a Gold Pile. */
  chance: number;
  /**
   * The amount a Gold Pile holds, rolled from this range inclusive for each
   * Monster Level: a Monster of Level 10 drops 10 times the numbers here.
   */
  perMonsterLevel: [number, number];
  /** How near the Hero must come to pick a Gold Pile up (tiles, centre to centre). */
  pickupReach: number;
} = {
  chance: 0.5,
  perMonsterLevel: [12, 28],
  pickupReach: 0.8,
};

/** The coin stacks a Gold Pile can show, smallest to biggest. */
export const GOLD_PILE_SIZES = ["single", "small", "medium", "large"] as const;

export type GoldPileSize = (typeof GOLD_PILE_SIZES)[number];

/**
 * Which stack a Gold Pile shows: the biggest size whose `from` its amount
 * reaches. Sorted by `from`, the first reaching 0.
 */
export const goldPileLooks: readonly { from: number; size: GoldPileSize }[] = [
  { from: 0, size: "single" },
  { from: 25, size: "small" },
  { from: 80, size: "medium" },
  { from: 200, size: "large" },
];

/** The stack a Gold Pile of `amount` shows. */
export function goldPileSize(amount: number): GoldPileSize {
  let size = goldPileLooks[0].size;
  for (const look of goldPileLooks) if (amount >= look.from) size = look.size;
  return size;
}
