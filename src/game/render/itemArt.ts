import { type ItemKind, type ItemType, itemOf } from "../tuning/items";

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

/**
 * The tint an Item type is drawn in, on the ground, in the Inventory and in
 * the Belt: its kind's, but each Potion type has its own.
 */
export function itemColour(type: ItemType): number {
  return TYPE_COLOUR[type] ?? KIND_COLOUR[itemOf(type).kind];
}

/**
 * The size of an Item's name in its box (CSS px), and the least it shrinks
 * to so a Short name fits.
 */
export const ITEM_TEXT = { size: 11, minSize: 10 };

/** The text an Item's box shows, and its size (CSS px). */
export type ItemLabel = { text: string; size: number };

/**
 * The label inside an Item's box, `width` CSS px wide inside, on one line:
 * the full `name` at `size` if it fits, else the Short name at `size` if it
 * fits, else the Short name at the largest size down to `minSize` that fits,
 * else at `minSize` anyway. `measure` gives a text's width at a size.
 */
export function itemLabel({
  name,
  shortName,
  width,
  measure,
  size = ITEM_TEXT.size,
  minSize = ITEM_TEXT.minSize,
}: {
  name: string;
  shortName: string;
  width: number;
  measure: (text: string, size: number) => number;
  size?: number;
  minSize?: number;
}): ItemLabel {
  if (measure(name, size) <= width) return { text: name, size };
  const shortWidth = measure(shortName, size);
  if (shortWidth <= width) return { text: shortName, size };
  // A text's width grows with its size, so this is the size it just fits at.
  return {
    text: shortName,
    size: Math.max(minSize, (size * width) / shortWidth),
  };
}
