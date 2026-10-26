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
