/** Item tuning: every Item type there is, and the Inventory's size. */

/** What an Item is for, which decides the Equipment slot it fits. */
export type ItemKind = "weapon" | "armour" | "ring" | "amulet";

/** What an Equipped Item can add to the Hero. */
export type Bonus =
  | "strength"
  | "dexterity"
  | "vitality"
  | "life"
  | "defense"
  | "attackRating";

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
};

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
    defense: 15,
    bonuses: {},
  },
  chainMail: {
    name: "Chain Mail",
    kind: "armour",
    size: { columns: 2, rows: 3 },
    defense: 35,
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
} satisfies Record<string, ItemTuning>;

/** One of the Item types, by its key in `itemTuning`. */
export type ItemType = keyof typeof itemTuning;

/** Every Item type, in the order `itemTuning` lists them. */
export const ITEM_TYPES = Object.keys(itemTuning) as ItemType[];

/** The tuning of an Item type, widened so optional fields can be read. */
export function itemOf(type: ItemType): ItemTuning {
  return itemTuning[type];
}

/** The Inventory grid's size in cells. */
export const inventoryTuning = { columns: 10, rows: 4 };
