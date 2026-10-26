/** Item tuning: every Item type there is, and the Inventory's size. */

import type { Attribute } from "../sim/world";

/** What an Item is for, which decides the Equipment slot it fits. */
export type ItemKind = "weapon" | "armour" | "ring" | "amulet" | "potion";

/** What an Equipped Item can add to the Hero: an Attribute, or one of these. */
export type Bonus = Attribute | "life" | "defense" | "attackRating";

/** What a Potion gives back. */
export type PotionResource = "life" | "mana";

/**
 * What drinking a Potion does: either give back `amount` of `resource`
 * evenly over `durationMs`, running its own course alongside any others, or
 * at once give back `share` of the maximum of each of `resources`.
 */
export type PotionEffectTuning =
  | {
      type: "overTime";
      resource: PotionResource;
      amount: number;
      durationMs: number;
    }
  | { type: "atOnce"; resources: PotionResource[]; share: number };

/** One Item type's tuning. */
export type ItemTuning = {
  /** Shown in the tooltip. */
  name: string;
  kind: ItemKind;
  /** How many Inventory cells it takes, across and down. */
  size: { columns: number; rows: number };
  /**
   * A Weapon's damage per hit before Strength, `[min, max]`, which Strength
   * scales as `heroTuning.unarmedDamage` describes.
   */
  damage?: [number, number];
  /** An Armour's base Defense. */
  defense?: number;
  /** What it adds to the Hero while Equipped. */
  bonuses: Partial<Record<Bonus, number>>;
  /** A Potion's effect when drunk. */
  potion?: PotionEffectTuning;
};

/** Every Item type, by the key it's known as in code and in the Save. */
export const itemTuning = {
  // 20–30 with the starting 20 Strength, as before Items.
  shortSword: {
    name: "Short Sword",
    kind: "weapon",
    size: { columns: 1, rows: 3 },
    damage: [50 / 3, 25],
    bonuses: {},
  },
  // 30–48 with the starting 20 Strength.
  axe: {
    name: "Axe",
    kind: "weapon",
    size: { columns: 2, rows: 3 },
    damage: [25, 40],
    bonuses: {},
  },
  leatherArmour: {
    name: "Leather Armour",
    kind: "armour",
    size: { columns: 2, rows: 3 },
    // A Skeleton's 20 Attack Rating hits it 85% of the time.
    defense: 27,
    bonuses: {},
  },
  chainMail: {
    name: "Chain Mail",
    kind: "armour",
    size: { columns: 2, rows: 3 },
    // A Skeleton hits it two times in three.
    defense: 40,
    bonuses: {},
  },
  ringOfStrength: {
    name: "Ring of Strength",
    kind: "ring",
    size: { columns: 1, rows: 1 },
    bonuses: { strength: 5 },
  },
  ringOfDexterity: {
    name: "Ring of Dexterity",
    kind: "ring",
    size: { columns: 1, rows: 1 },
    bonuses: { dexterity: 5 },
  },
  ringOfLife: {
    name: "Ring of Life",
    kind: "ring",
    size: { columns: 1, rows: 1 },
    bonuses: { life: 10 },
  },
  amuletOfVitality: {
    name: "Amulet of Vitality",
    kind: "amulet",
    size: { columns: 1, rows: 1 },
    bonuses: { vitality: 5 },
  },
  lifePotion: {
    name: "Life Potion",
    kind: "potion",
    size: { columns: 1, rows: 1 },
    bonuses: {},
    potion: {
      type: "overTime",
      resource: "life",
      amount: 30,
      durationMs: 4000,
    },
  },
  manaPotion: {
    name: "Mana Potion",
    kind: "potion",
    size: { columns: 1, rows: 1 },
    bonuses: {},
    potion: {
      type: "overTime",
      resource: "mana",
      amount: 20,
      durationMs: 4000,
    },
  },
  rejuvenationPotion: {
    name: "Rejuvenation Potion",
    kind: "potion",
    size: { columns: 1, rows: 1 },
    bonuses: {},
    potion: { type: "atOnce", resources: ["life", "mana"], share: 0.35 },
  },
} satisfies Record<string, ItemTuning>;

/** One of the Item types, by its key in `itemTuning`. */
export type ItemType = keyof typeof itemTuning;

/** Every Item type, in the order `itemTuning` lists them. */
export const ITEM_TYPES = Object.keys(itemTuning) as ItemType[];

/** The tuning of an Item type, widened so optional fields can be read. */
export function itemOf(type: ItemType): ItemTuning {
  return itemTuning[type];
}

/** Whether an Item type is a Potion. */
export function isPotion(type: ItemType): boolean {
  return itemTuning[type].kind === "potion";
}

/** The Inventory grid's size in cells. */
export const inventoryTuning = { columns: 10, rows: 4 };

/**
 * The Belt Columns: how many there are, how many rows each has with no Belt
 * Equipped, and the Potions a New Hero starts with in them, filled column by
 * column from the left, each from the bottom up.
 */
export const beltTuning: {
  columns: number;
  rowsWithoutBelt: number;
  newHeroPotions: { type: ItemType; count: number };
} = {
  columns: 4,
  rowsWithoutBelt: 1,
  newHeroPotions: { type: "lifePotion", count: 4 },
};

/**
 * Monster drops: each kill has `chance` of dropping one Item, of a type
 * picked from `items` with equal odds. Potions have no part in it.
 */
export const dropTuning: { chance: number; items: readonly ItemType[] } = {
  chance: 0.25,
  items: ITEM_TYPES.filter((type) => !isPotion(type)),
};

/**
 * Potion drops, rolled on each kill apart from `dropTuning` and more often:
 * `chance` of dropping one Potion, of a type picked from `items` with equal
 * odds.
 */
export const potionDropTuning: { chance: number; items: readonly ItemType[] } =
  {
    chance: 0.4,
    items: ITEM_TYPES.filter(isPotion),
  };
