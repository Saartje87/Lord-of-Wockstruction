import {
  type ItemKind,
  type ItemType,
  itemOf,
  type Rarity,
} from "../tuning/items";

/** The tint of each kind of Item, wherever it's drawn. */
const KIND_COLOUR: Record<ItemKind, number> = {
  weapon: 0x4a4a52,
  armour: 0x5a4028,
  ring: 0x3a3a68,
  amulet: 0x5a3a5a,
  belt: 0x6a5030,
  potion: 0x7a2424,
};

/** Item types tinted their own colour rather than their kind's. */
const TYPE_COLOUR: Partial<Record<ItemType, number>> = {
  lifePotion: 0xa02424,
  manaPotion: 0x2a46b0,
  rejuvenationPotion: 0x8a2aa0,
};

/** The colour an Item's name is drawn in: white, or blue for Magic. */
export function rarityColour(rarity: Rarity): number {
  if (rarity === "rare") return 0xffe05a;
  return rarity === "magic" ? 0x6f8fff : 0xe8e0c8;
}

/**
 * The tint an Item type is drawn in, on the ground, in the Inventory and in
 * the Belt: its kind's, but each Potion type has its own.
 */
export function itemColour(type: ItemType): number {
  return TYPE_COLOUR[type] ?? KIND_COLOUR[itemOf(type).kind];
}

/**
 * The size of an Item's name in its box (CSS px), and the least it shrinks
 * to so a Short name fits, at a UI Scale of 1: they grow with a larger UI
 * Scale but never shrink with a smaller one.
 */
export const ITEM_TEXT = { size: 11, minSize: 10 };

/** The text an Item's box shows, and its size (CSS px). */
export type ItemLabel = { text: string; size: number };

/**
 * The label inside an Item's box, `width` CSS px wide inside, on one line,
 * at the UI Scale `uiScale`: the full `name` at the `ITEM_TEXT` size if it
 * fits, else the Short name at that size if it fits, else the Short name at
 * the largest size down to the `ITEM_TEXT` floor that fits, else at the
 * floor anyway. `measure` gives a text's width at a size.
 */
export function itemLabel({
  name,
  shortName,
  width,
  measure,
  uiScale = 1,
}: {
  name: string;
  shortName: string;
  width: number;
  measure: (text: string, size: number) => number;
  uiScale?: number;
}): ItemLabel {
  const grown = Math.max(1, uiScale);
  const size = ITEM_TEXT.size * grown;
  if (measure(name, size) <= width) return { text: name, size };
  const fits = (at: number) => measure(shortName, at) <= width;
  if (fits(size)) return { text: shortName, size };
  const minSize = ITEM_TEXT.minSize * grown;
  // Were its width in step with its size, it would just fit here.
  const inStep = (size * width) / measure(shortName, size);
  if (inStep <= minSize || !fits(minSize)) {
    return { text: shortName, size: minSize };
  }
  if (fits(inStep)) return { text: shortName, size: inStep };
  // It doesn't narrow in step, so close in on the largest size that fits.
  let fitting = minSize;
  let tooBig = inStep;
  for (let step = 0; step < 12; step++) {
    const between = (fitting + tooBig) / 2;
    if (fits(between)) fitting = between;
    else tooBig = between;
  }
  return { text: shortName, size: fitting };
}
