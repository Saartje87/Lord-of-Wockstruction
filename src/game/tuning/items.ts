/** Item tuning: every Item type there is, and the Inventory's size. */

import type { Attribute } from "../sim/world";

/** What an Item is for, which decides the Equipment slot it fits. */
export type ItemKind =
  | "weapon"
  | "armour"
  | "ring"
  | "amulet"
  | "belt"
  | "potion";

/** What an Equipped Item can add to the Hero: an Attribute, or one of these. */
export type Bonus =
  | Attribute
  | "life"
  | "defense"
  | "attackRating"
  | "weaponDamage";

/** Every Bonus there is. */
export const BONUSES: readonly Bonus[] = [
  "strength",
  "dexterity",
  "vitality",
  "energy",
  "life",
  "defense",
  "attackRating",
  "weaponDamage",
];

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
  /** Shown in the tooltip, and on the Item's box where it fits. */
  name: string;
  /** Its Short name, shown on its box where `name` won't fit on one line. */
  shortName: string;
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
  /** How many rows a Belt gives each Belt Column while Equipped. */
  beltRows?: number;
};

/** Every Item type, by the key it's known as in code and in the Save. */
export const itemTuning = {
  // 20–30 with the starting 20 Strength, as before Items.
  shortSword: {
    name: "Short Sword",
    shortName: "Sword",
    kind: "weapon",
    size: { columns: 1, rows: 3 },
    damage: [50 / 3, 25],
    bonuses: {},
  },
  // 30–48 with the starting 20 Strength.
  axe: {
    name: "Axe",
    shortName: "Axe",
    kind: "weapon",
    size: { columns: 2, rows: 3 },
    damage: [25, 40],
    bonuses: {},
  },
  leatherArmour: {
    name: "Leather Armour",
    shortName: "Leather",
    kind: "armour",
    size: { columns: 2, rows: 3 },
    // A Skeleton's 20 Attack Rating hits it 85% of the time.
    defense: 27,
    bonuses: {},
  },
  chainMail: {
    name: "Chain Mail",
    shortName: "Chain",
    kind: "armour",
    size: { columns: 2, rows: 3 },
    // A Skeleton hits it two times in three.
    defense: 40,
    bonuses: {},
  },
  ringOfStrength: {
    name: "Ring of Strength",
    shortName: "Str",
    kind: "ring",
    size: { columns: 1, rows: 1 },
    bonuses: { strength: 5 },
  },
  ringOfDexterity: {
    name: "Ring of Dexterity",
    shortName: "Dex",
    kind: "ring",
    size: { columns: 1, rows: 1 },
    bonuses: { dexterity: 5 },
  },
  ringOfLife: {
    name: "Ring of Life",
    shortName: "Life",
    kind: "ring",
    size: { columns: 1, rows: 1 },
    bonuses: { life: 10 },
  },
  amuletOfVitality: {
    name: "Amulet of Vitality",
    shortName: "Vit",
    kind: "amulet",
    size: { columns: 1, rows: 1 },
    bonuses: { vitality: 5 },
  },
  sash: {
    name: "Sash",
    shortName: "Sash",
    kind: "belt",
    size: { columns: 2, rows: 1 },
    bonuses: {},
    beltRows: 2,
  },
  heavyBelt: {
    name: "Heavy Belt",
    shortName: "Heavy",
    kind: "belt",
    size: { columns: 2, rows: 1 },
    bonuses: {},
    beltRows: 3,
  },
  platedBelt: {
    name: "Plated Belt",
    shortName: "Plated",
    kind: "belt",
    size: { columns: 2, rows: 1 },
    bonuses: {},
    beltRows: 4,
  },
  lifePotion: {
    name: "Life Potion",
    shortName: "Life",
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
    shortName: "Mana",
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
    shortName: "Rejuv",
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

/** How special an Item is: Normal has no Affixes, Magic has one or two. */
export type Rarity = "normal" | "magic";

/** Every Rarity, plainest first. */
export const RARITIES: readonly Rarity[] = ["normal", "magic"];

/**
 * Rarity odds and Affix counts, as weights. A non-Potion drop rolls its
 * Rarity from `rarity`; a Magic Item rolls one or two Affixes by
 * `magicAffixes`.
 */
export const rarityTuning: {
  rarity: Record<Rarity, number>;
  magicAffixes: { one: number; two: number };
} = {
  // About 74% Normal and 26% Magic until Rare joins them.
  rarity: { normal: 70, magic: 25 },
  magicAffixes: { one: 60, two: 40 },
};

/** Whether an Affix is named before the type (Prefix) or after it (Suffix). */
export type AffixSide = "prefix" | "suffix";

/** One grade of an Affix kind. */
export type AffixGrade = {
  /** Shown in the Item's name: "Sturdy", "of the Badger". */
  name: string;
  /** The value an Affix of this grade rolls, `[min, max]` inclusive. */
  range: [number, number];
  /** The lowest Monster Level whose drops can roll this grade. */
  fromMonsterLevel: number;
  /** Its odds among the grades the Monster Level reaches. */
  weight: number;
};

/** One Affix kind's tuning. */
export type AffixTuning = {
  side: AffixSide;
  bonus: Bonus;
  /** The Item kinds it can roll on. */
  rollsOn: readonly ItemKind[];
  /** Weakest first. */
  grades: readonly AffixGrade[];
};

const NOT_POTION: readonly ItemKind[] = [
  "weapon",
  "armour",
  "ring",
  "amulet",
  "belt",
];

type Range = [number, number];

/** Three grades, weakest first, gated from Monster Level 1, 5 and 9. */
function threeGrades(
  names: [string, string, string],
  ranges: [Range, Range, Range],
): AffixGrade[] {
  const gates = [1, 5, 9];
  const weights = [60, 30, 10];
  return names.map((name, i) => ({
    name,
    range: ranges[i],
    fromMonsterLevel: gates[i],
    weight: weights[i],
  }));
}

const ATTRIBUTE_RANGES: [Range, Range, Range] = [
  [1, 3],
  [4, 6],
  [7, 10],
];

/** Every Affix kind there is, by the key it's known as in code and the Save. */
export const affixTuning = {
  defense: {
    side: "prefix",
    bonus: "defense",
    rollsOn: ["armour", "belt"],
    grades: threeGrades(
      ["Sturdy", "Stout", "Ironclad"],
      [
        [5, 10],
        [11, 20],
        [21, 32],
      ],
    ),
  },
  accuracy: {
    side: "prefix",
    bonus: "attackRating",
    rollsOn: ["weapon", "ring", "amulet"],
    grades: threeGrades(
      ["Keen", "Sharp", "Unerring"],
      [
        [10, 20],
        [21, 40],
        [41, 70],
      ],
    ),
  },
  life: {
    side: "prefix",
    bonus: "life",
    rollsOn: NOT_POTION,
    grades: threeGrades(
      ["Hearty", "Robust", "Wockhearted"],
      [
        [5, 10],
        [11, 20],
        [21, 35],
      ],
    ),
  },
  brutality: {
    side: "prefix",
    bonus: "weaponDamage",
    rollsOn: ["weapon"],
    grades: threeGrades(
      ["Brutal", "Savage", "Wrecking"],
      [
        [1, 3],
        [4, 7],
        [8, 12],
      ],
    ),
  },
  strength: {
    side: "suffix",
    bonus: "strength",
    rollsOn: NOT_POTION,
    grades: threeGrades(
      ["of the Badger", "of the Bear", "of the Mammoth"],
      ATTRIBUTE_RANGES,
    ),
  },
  dexterity: {
    side: "suffix",
    bonus: "dexterity",
    rollsOn: NOT_POTION,
    grades: threeGrades(
      ["of the Hare", "of the Fox", "of the Falcon"],
      ATTRIBUTE_RANGES,
    ),
  },
  vitality: {
    side: "suffix",
    bonus: "vitality",
    rollsOn: NOT_POTION,
    grades: threeGrades(
      ["of the Reed", "of the Oak", "of the Mountain"],
      ATTRIBUTE_RANGES,
    ),
  },
  energy: {
    side: "suffix",
    bonus: "energy",
    rollsOn: NOT_POTION,
    grades: threeGrades(
      ["of the Wren", "of the Owl", "of the Sage"],
      ATTRIBUTE_RANGES,
    ),
  },
} satisfies Record<string, AffixTuning>;

/** One of the Affix kinds, by its key in `affixTuning`. */
export type AffixKind = keyof typeof affixTuning;

/** Every Affix kind, in the order `affixTuning` lists them. */
export const AFFIX_KINDS = Object.keys(affixTuning) as AffixKind[];

/** The tuning of an Affix kind, widened so its fields read plainly. */
export function affixOf(kind: AffixKind): AffixTuning {
  return affixTuning[kind];
}
