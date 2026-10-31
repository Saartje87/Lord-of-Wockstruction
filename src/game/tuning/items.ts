/** Item tuning: every Item type there is, and the Inventory's size. */

import type { Attribute } from "../sim/world";
import { type Skill, skillTuning } from "./skills";

/** What an Item is for, which decides the Equipment slot it fits. */
export type ItemKind =
  | "weapon"
  | "armour"
  | "helm"
  | "gloves"
  | "boots"
  | "shield"
  | "wand"
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
  | "weaponDamage"
  | "mana"
  | "enhancedDamage"
  | "enhancedDefense"
  | "fireResistance"
  | "coldResistance"
  | "lightningResistance"
  | "allResistances"
  | "block"
  | "fireDamage"
  | "coldDamage"
  | "lightningDamage"
  | "attackSpeed"
  | "walkSpeed"
  | "skillLevel";

/**
 * Every Bonus there is, but `skillLevel`, which only an Affix gives and which
 * names a Skill.
 */
export const BONUSES: readonly Bonus[] = [
  "strength",
  "dexterity",
  "vitality",
  "energy",
  "life",
  "defense",
  "attackRating",
  "weaponDamage",
  "mana",
  "enhancedDamage",
  "enhancedDefense",
  "fireResistance",
  "coldResistance",
  "lightningResistance",
  "allResistances",
  "block",
  "fireDamage",
  "coldDamage",
  "lightningDamage",
  "attackSpeed",
  "walkSpeed",
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
  /** An armour piece's own Defense: Armour, Helm, Gloves, Boots or Shield. */
  defense?: number;
  /** A Shield's own chance to Block, in percent. */
  block?: number;
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
  leatherCap: {
    name: "Leather Cap",
    shortName: "Cap",
    kind: "helm",
    size: { columns: 2, rows: 2 },
    defense: 8,
    bonuses: {},
  },
  ironHelm: {
    name: "Iron Helm",
    shortName: "Helm",
    kind: "helm",
    size: { columns: 2, rows: 2 },
    defense: 16,
    bonuses: {},
  },
  leatherGloves: {
    name: "Leather Gloves",
    shortName: "Gloves",
    kind: "gloves",
    size: { columns: 2, rows: 2 },
    defense: 6,
    bonuses: {},
  },
  chainGloves: {
    name: "Chain Gloves",
    shortName: "Chain",
    kind: "gloves",
    size: { columns: 2, rows: 2 },
    defense: 12,
    bonuses: {},
  },
  leatherBoots: {
    name: "Leather Boots",
    shortName: "Boots",
    kind: "boots",
    size: { columns: 2, rows: 2 },
    defense: 6,
    bonuses: {},
  },
  chainBoots: {
    name: "Chain Boots",
    shortName: "Chain",
    kind: "boots",
    size: { columns: 2, rows: 2 },
    defense: 12,
    bonuses: {},
  },
  buckler: {
    name: "Buckler",
    shortName: "Buckler",
    kind: "shield",
    size: { columns: 2, rows: 2 },
    defense: 14,
    block: 15,
    bonuses: {},
  },
  towerShield: {
    name: "Tower Shield",
    shortName: "Tower",
    kind: "shield",
    size: { columns: 2, rows: 3 },
    defense: 28,
    block: 25,
    bonuses: {},
  },
  // Little damage and + Mana; a Wand fits the Weapon slot and the Off-hand.
  boneWand: {
    name: "Bone Wand",
    shortName: "Bone",
    kind: "wand",
    size: { columns: 1, rows: 2 },
    damage: [3, 6],
    bonuses: { mana: 15 },
  },
  yewWand: {
    name: "Yew Wand",
    shortName: "Yew",
    kind: "wand",
    size: { columns: 1, rows: 2 },
    damage: [4, 8],
    bonuses: { mana: 30 },
  },
  ring: {
    name: "Ring",
    shortName: "Ring",
    kind: "ring",
    size: { columns: 1, rows: 1 },
    bonuses: {},
  },
  amulet: {
    name: "Amulet",
    shortName: "Amulet",
    kind: "amulet",
    size: { columns: 1, rows: 1 },
    bonuses: {},
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

/** Block: the most the Hero's chance to Block can be, in percent. */
export const blockTuning = { cap: 50 };

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
export type Rarity = "normal" | "magic" | "rare";

/** Every Rarity, plainest first. */
export const RARITIES: readonly Rarity[] = ["normal", "magic", "rare"];

/**
 * Rarity odds and Affix counts, as weights. A non-Potion drop rolls its
 * Rarity from `rarity`, a Unique Monster's from `uniqueRarity`; a Magic Item
 * rolls one or two Affixes by `magicAffixes`, a Rare Item three or four by
 * `rareAffixes`, and a Rare Item is named by a word of each list in
 * `rareNames`. `affixCounts` is the fewest and most Affixes of each Rarity
 * and `perSide` the most on one side (Prefix or Suffix); `sideOdds` weighs
 * the side a lone Magic Affix, or a Rare Item's doubled side, takes.
 */
export const rarityTuning: {
  rarity: Record<Rarity, number>;
  uniqueRarity: Record<Rarity, number>;
  affixCounts: Record<Rarity, [number, number]>;
  perSide: Record<Rarity, number>;
  sideOdds: Record<"prefix" | "suffix", number>;
  magicAffixes: { one: number; two: number };
  rareAffixes: { three: number; four: number };
  rareNames: { first: readonly string[]; second: readonly string[] };
} = {
  // 70% Normal, 25% Magic and 5% Rare.
  rarity: { normal: 70, magic: 25, rare: 5 },
  // 30% Normal, 45% Magic and 25% Rare.
  uniqueRarity: { normal: 30, magic: 45, rare: 25 },
  affixCounts: { normal: [0, 0], magic: [1, 2], rare: [3, 4] },
  perSide: { normal: 0, magic: 1, rare: 2 },
  sideOdds: { prefix: 1, suffix: 1 },
  magicAffixes: { one: 60, two: 40 },
  rareAffixes: { three: 60, four: 40 },
  rareNames: {
    first: [
      "Gloom",
      "Thorn",
      "Ash",
      "Marrow",
      "Cinder",
      "Dusk",
      "Rue",
      "Hollow",
      "Wrath",
      "Briar",
    ],
    second: [
      "Bane",
      "Fang",
      "Ward",
      "Grip",
      "Song",
      "Knell",
      "Bite",
      "Coil",
      "Spire",
      "Brand",
    ],
  },
};

/** Whether an Affix is named before the type (Prefix) or after it (Suffix). */
export type AffixSide = "prefix" | "suffix";

/** One grade of an Affix kind. */
export type AffixGrade = {
  /** Shown in the Item's name: "Sturdy", "of the Badger". */
  name: string;
  /** The value an Affix of this grade rolls, `[min, max]` inclusive. */
  range: [number, number];
  /**
   * For an Affix that adds a damage range, the values its high end rolls,
   * `[min, max]` inclusive; `range` is then its low end's.
   */
  highRange?: [number, number];
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
  /** For a Skill Level Affix, the Skill whose Skill Level it raises. */
  skill?: Skill;
  /**
   * Its odds among the kinds of its side that suit the Item; missing, 100.
   * A rarer kind has less.
   */
  weight?: number;
  /** Weakest first. */
  grades: readonly AffixGrade[];
};

/** The Item kinds that give Defense. */
const ARMOUR_KINDS: readonly ItemKind[] = [
  "armour",
  "helm",
  "gloves",
  "boots",
  "shield",
];

const NOT_POTION: readonly ItemKind[] = [
  "weapon",
  "wand",
  ...ARMOUR_KINDS,
  "ring",
  "amulet",
  "belt",
];

type Range = [number, number];

/** Three grades, weakest first, gated from Monster Level 1, 5 and 9. */
function threeGrades(
  names: [string, string, string],
  ranges: [Range, Range, Range],
  highRanges?: [Range, Range, Range],
): AffixGrade[] {
  const gates = [1, 5, 9];
  const weights = [60, 30, 10];
  return names.map((name, i) => ({
    name,
    range: ranges[i],
    ...(highRanges && { highRange: highRanges[i] }),
    fromMonsterLevel: gates[i],
    weight: weights[i],
  }));
}

/** The Item kinds the Resistance Affixes roll on. */
const RESISTANCE_KINDS: readonly ItemKind[] = [
  ...ARMOUR_KINDS,
  "belt",
  "ring",
  "amulet",
];

/** The rolled range of each grade of a Resistance Affix, weakest first. */
const RESISTANCE_RANGES: [Range, Range, Range] = [
  [5, 10],
  [11, 20],
  [21, 30],
];

/** The Item kinds the Weapon Affixes roll on. */
const WEAPON_KINDS: readonly ItemKind[] = ["weapon", "wand"];

/** The low end of the Element damage added to each of the Hero's attacks; to be tuned. */
const ELEMENTAL_DAMAGE_RANGES: [Range, Range, Range] = [
  [1, 3],
  [4, 8],
  [9, 15],
];

/**
 * The high end of that damage, a little above the low end; to be tuned. Each
 * starts where the low end's does, so an older Save's single value v, loaded
 * as v to v, is always inside; a roll never puts the high below the low.
 */
const ELEMENTAL_DAMAGE_HIGH_RANGES: [Range, Range, Range] = [
  [1, 6],
  [4, 14],
  [9, 24],
];

const ATTRIBUTE_RANGES: [Range, Range, Range] = [
  [1, 3],
  [4, 6],
  [7, 10],
];

/** The key of the Affix kind raising a Skill's Skill Level: "skillBoneSpear". */
export type SkillAffixKind = `skill${Capitalize<Skill>}`;

/** The Affix kind raising `skill`'s Skill Level. */
export function skillAffixKind(skill: Skill): SkillAffixKind {
  return `skill${skill[0].toUpperCase()}${skill.slice(1)}` as SkillAffixKind;
}

/**
 * One Affix kind per Skill, each a Wand-only Suffix raising that Skill's
 * Skill Level by 1, 2 or 3. Each is rarer than a plain Suffix, as there are
 * many; to be tuned.
 */
const skillAffixTuning = Object.fromEntries(
  (Object.keys(skillTuning) as Skill[]).map((skill) => [
    skillAffixKind(skill),
    {
      side: "suffix",
      bonus: "skillLevel",
      rollsOn: ["wand"],
      skill,
      weight: 25,
      grades: threeGrades(
        ["of the Acolyte", "of the Adept", "of the Master"],
        [
          [1, 1],
          [2, 2],
          [3, 3],
        ],
      ),
    } satisfies AffixTuning,
  ]),
) as unknown as Record<SkillAffixKind, AffixTuning>;

/** Every Affix kind there is, by the key it's known as in code and the Save. */
export const affixTuning = {
  ...skillAffixTuning,
  defense: {
    side: "prefix",
    bonus: "defense",
    rollsOn: [...ARMOUR_KINDS, "belt"],
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
    rollsOn: [...WEAPON_KINDS, "ring", "amulet"],
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
    rollsOn: WEAPON_KINDS,
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
  mana: {
    side: "suffix",
    bonus: "mana",
    rollsOn: NOT_POTION,
    grades: threeGrades(
      ["of the Spring", "of the Well", "of the Wellspring"],
      [
        [5, 10],
        [11, 20],
        [21, 35],
      ],
    ),
  },
  // The two below are percentages of the Item's own damage or Defense.
  enhancedDamage: {
    side: "prefix",
    bonus: "enhancedDamage",
    rollsOn: WEAPON_KINDS,
    grades: threeGrades(
      ["Jagged", "Vicious", "Ruinous"],
      [
        [10, 20],
        [21, 40],
        [41, 70],
      ],
    ),
  },
  enhancedDefense: {
    side: "prefix",
    bonus: "enhancedDefense",
    rollsOn: ARMOUR_KINDS,
    grades: threeGrades(
      ["Reinforced", "Fortified", "Bastioned"],
      [
        [10, 20],
        [21, 40],
        [41, 60],
      ],
    ),
  },
  // Resistances: the Elements' Prefixes roll on the Defense kinds, Belts,
  // Rings and Amulets. All Resistances is rarer and weaker; to be tuned.
  fireResistance: {
    side: "prefix",
    bonus: "fireResistance",
    rollsOn: RESISTANCE_KINDS,
    grades: threeGrades(["Ruby", "Garnet", "Bloodstone"], RESISTANCE_RANGES),
  },
  coldResistance: {
    side: "prefix",
    bonus: "coldResistance",
    rollsOn: RESISTANCE_KINDS,
    grades: threeGrades(["Sapphire", "Azurite", "Glacial"], RESISTANCE_RANGES),
  },
  lightningResistance: {
    side: "prefix",
    bonus: "lightningResistance",
    rollsOn: RESISTANCE_KINDS,
    grades: threeGrades(["Amber", "Topaz", "Stormglass"], RESISTANCE_RANGES),
  },
  allResistances: {
    side: "prefix",
    bonus: "allResistances",
    rollsOn: RESISTANCE_KINDS,
    weight: 25,
    grades: threeGrades(
      ["Shimmering", "Prismatic", "Wockstone"],
      [
        [3, 5],
        [6, 9],
        [10, 14],
      ],
    ),
  },
  block: {
    side: "suffix",
    bonus: "block",
    rollsOn: ["shield"],
    grades: threeGrades(
      ["of Parrying", "of Deflection", "of the Bulwark"],
      [
        [3, 5],
        [6, 9],
        [10, 15],
      ],
    ),
  },
  // Weapon Suffixes: flat Element damage on the Hero's attacks, never Skills.
  fireDamage: {
    side: "suffix",
    bonus: "fireDamage",
    rollsOn: WEAPON_KINDS,
    grades: threeGrades(
      ["of Embers", "of Flames", "of the Furnace"],
      ELEMENTAL_DAMAGE_RANGES,
      ELEMENTAL_DAMAGE_HIGH_RANGES,
    ),
  },
  coldDamage: {
    side: "suffix",
    bonus: "coldDamage",
    rollsOn: WEAPON_KINDS,
    grades: threeGrades(
      ["of Frost", "of Ice", "of the Glacier"],
      ELEMENTAL_DAMAGE_RANGES,
      ELEMENTAL_DAMAGE_HIGH_RANGES,
    ),
  },
  lightningDamage: {
    side: "suffix",
    bonus: "lightningDamage",
    rollsOn: WEAPON_KINDS,
    grades: threeGrades(
      ["of Sparks", "of Storms", "of Thunder"],
      ELEMENTAL_DAMAGE_RANGES,
      ELEMENTAL_DAMAGE_HIGH_RANGES,
    ),
  },
  // Speed Suffixes: the Hero's swing and walk, never casting.
  attackSpeed: {
    side: "suffix",
    bonus: "attackSpeed",
    rollsOn: ["gloves"],
    grades: threeGrades(
      ["of Alacrity", "of Haste", "of the Whirlwind"],
      [
        [5, 8],
        [9, 14],
        [15, 22],
      ],
    ),
  },
  walkSpeed: {
    side: "suffix",
    bonus: "walkSpeed",
    rollsOn: ["boots"],
    grades: threeGrades(
      ["of the Wanderer", "of the Courier", "of the Gale"],
      [
        [5, 8],
        [9, 14],
        [15, 22],
      ],
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
