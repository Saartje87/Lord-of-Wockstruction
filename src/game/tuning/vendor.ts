/** Vendor tuning: what the Vendor stocks, and what an Item is worth. */

import type { ItemKind, ItemType, Rarity } from "./items";

/**
 * The Vendor's goods: the grid's size in cells, and how many Normal Items of
 * each kind besides Potions they stock on every arrival in Town, rolled from
 * the range `[min, max]` inclusive. The Vendor always holds one of every
 * Potion, whatever this says.
 */
export const vendorTuning: {
  grid: { columns: number; rows: number };
  stock: Partial<Record<ItemKind, [number, number]>>;
} = {
  grid: { columns: 8, rows: 6 },
  stock: { weapon: [2, 3], armour: [2, 3], belt: [1, 2] },
};

/**
 * What an Item is worth in Gold (its Value): a base for each Item type,
 * multiplied by its Rarity's factor and by one plus a share for each of its
 * Affixes, by grade, weakest first. The Vendor sells at the Value and buys
 * for `buyShare` of it.
 */
export const valueTuning: {
  base: Record<ItemType, number>;
  rarity: Record<Rarity, number>;
  affixShare: readonly number[];
  /** The share of an Item's Value the Vendor pays for it, rounded down. */
  buyShare: number;
} = {
  base: {
    shortSword: 40,
    axe: 70,
    leatherArmour: 50,
    chainMail: 120,
    leatherCap: 40,
    ironHelm: 90,
    leatherGloves: 35,
    chainGloves: 80,
    leatherBoots: 35,
    chainBoots: 80,
    buckler: 70,
    towerShield: 130,
    ring: 60,
    amulet: 80,
    sash: 30,
    heavyBelt: 60,
    platedBelt: 100,
    lifePotion: 25,
    manaPotion: 25,
    rejuvenationPotion: 60,
  },
  rarity: { normal: 1, magic: 2, rare: 4 },
  affixShare: [0.25, 0.5, 1],
  buyShare: 0.25,
};
