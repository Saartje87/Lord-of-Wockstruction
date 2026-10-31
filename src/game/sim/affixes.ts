/** Rolling, naming and checking an Item's Rarity and Affixes. */

import {
  AFFIX_KINDS,
  type AffixKind,
  type AffixSide,
  affixOf,
  type Bonus,
  hasDamageRange,
  type ItemType,
  isPotion,
  itemOf,
  type Rarity,
  rarityTuning,
} from "../tuning/items";
import { type Rng, random, randomInt } from "./random";

/**
 * One rolled Affix: its kind, the index of its grade and the value it rolled.
 * An Affix that adds a damage range rolls `value` as its low end and `high`
 * as its high end; no other has a `high`.
 */
export type RolledAffix = {
  kind: AffixKind;
  grade: number;
  value: number;
  high?: number;
};

/** What sets an Item of a type apart from the rest of its type. */
export type ItemRoll = {
  rarity: Rarity;
  affixes: RolledAffix[];
  /** A Rare Item's two-word name; no other Item has one. */
  rareName?: string;
};

/** The odds of an Affix kind with no `weight` of its own. */
const DEFAULT_KIND_WEIGHT = 100;

const RARITY_ORDER: readonly Rarity[] = ["normal", "magic", "rare"];

/** Picks an index by `weights`, advancing `rng` once. */
function pickWeighted(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = random(rng) * total;
  for (let i = 0; i < weights.length; i++) {
    if (roll < weights[i]) return i;
    roll -= weights[i];
  }
  return weights.length - 1;
}

/** The Affix kinds on `side` that can roll on an Item of `type`. */
function kindsFor(type: ItemType, side: AffixSide): AffixKind[] {
  const { kind } = itemOf(type);
  return AFFIX_KINDS.filter((affix) => {
    const tuning = affixOf(affix);
    return tuning.side === side && tuning.rollsOn.includes(kind);
  });
}

/**
 * Rolls one Affix of `kind` among the grades `monsterLevel` reaches. An
 * Affix with a damage range takes one draw more, for its high end, so a drop
 * with none rolls the seeded sequence it always did.
 */
function rollAffix(
  rng: Rng,
  kind: AffixKind,
  monsterLevel: number,
): RolledAffix {
  const { grades } = affixOf(kind);
  const reached = grades
    .map((grade, index) => ({ grade, index }))
    .filter(({ grade }) => grade.fromMonsterLevel <= monsterLevel);
  const pool = reached.length > 0 ? reached : [{ grade: grades[0], index: 0 }];
  const picked =
    pool[
      pickWeighted(
        rng,
        pool.map((p) => p.grade.weight),
      )
    ];
  const value = randomInt(rng, picked.grade.range);
  if (!hasDamageRange(kind)) return { kind, grade: picked.index, value };
  // The high end is never below the low end.
  const [highMin, highMax] = picked.grade.highRange ?? picked.grade.range;
  const high = randomInt(rng, [Math.max(highMin, value), highMax]);
  return { kind, grade: picked.index, value, high };
}

/**
 * Rolls a drop's Rarity and Affixes from the seeded `rng`: a Potion is
 * always Normal and rolls nothing; any other Item rolls Normal, Magic or
 * Rare by `rarityTuning` (a Ring or Amulet never Normal). A Magic Item gets one or two Affixes, at most one
 * Prefix and one Suffix; a Rare Item three or four, at most two of each
 * side, and a two-word name. Never two of a kind, each in a grade
 * `monsterLevel` reaches. A Unique Monster's drop rolls its Rarity by
 * `rarityTuning.uniqueRarity`. `only` limits the Rarity to those it lists,
 * keeping their relative odds.
 */
export function rollItem(
  rng: Rng,
  type: ItemType,
  monsterLevel: number,
  unique = false,
  only?: readonly Rarity[],
): ItemRoll {
  if (isPotion(type)) return { rarity: "normal", affixes: [] };
  const { normal, magic, rare } = unique
    ? rarityTuning.uniqueRarity
    : rarityTuning.rarity;
  // A Ring or Amulet re-rolls Normal: it drops Magic or Rare.
  const never = itemOf(type).kind === "ring" || itemOf(type).kind === "amulet";
  const rarity =
    RARITY_ORDER[
      pickWeighted(
        rng,
        [never ? 0 : normal, magic, rare].map((weight, i) =>
          only && !only.includes(RARITY_ORDER[i]) ? 0 : weight,
        ),
      )
    ];
  if (rarity === "normal") return { rarity, affixes: [] };
  const { prefix: prefixOdds, suffix: suffixOdds } = rarityTuning.sideOdds;
  const coin = () => pickWeighted(rng, [prefixOdds, suffixOdds]);
  let sides: AffixSide[];
  if (rarity === "magic") {
    const { one, two } = rarityTuning.magicAffixes;
    const count = pickWeighted(rng, [one, two]) + 1;
    sides =
      count === 2 ? ["prefix", "suffix"] : [coin() === 0 ? "prefix" : "suffix"];
  } else {
    const { three, four } = rarityTuning.rareAffixes;
    const count = pickWeighted(rng, [three, four]) + 3;
    // Three Affixes are two of one side and one of the other.
    const more: AffixSide = coin() === 0 ? "prefix" : "suffix";
    const less: AffixSide = more === "prefix" ? "suffix" : "prefix";
    sides =
      count === 4
        ? ["prefix", "prefix", "suffix", "suffix"]
        : [more, more, less];
  }
  const affixes: RolledAffix[] = [];
  for (const side of sides) {
    const kinds = kindsFor(type, side).filter(
      (kind) => !affixes.some((a) => a.kind === kind),
    );
    if (kinds.length === 0) continue;
    const kind =
      kinds[
        pickWeighted(
          rng,
          kinds.map((one) => affixOf(one).weight ?? DEFAULT_KIND_WEIGHT),
        )
      ];
    affixes.push(rollAffix(rng, kind, monsterLevel));
  }
  if (rarity === "magic") return { rarity, affixes };
  const { first, second } = rarityTuning.rareNames;
  const firstWord = first[randomInt(rng, [0, first.length - 1])];
  const secondWord = second[randomInt(rng, [0, second.length - 1])];
  return { rarity, affixes, rareName: `${firstWord} ${secondWord}` };
}

/** The name of the grade an Affix rolled in. */
function gradeName(affix: RolledAffix): string {
  return affixOf(affix.kind).grades[affix.grade].name;
}

/** What names an Item: its type, Affixes and Rare name. */
export type Titled = {
  type: ItemType;
  affixes?: readonly RolledAffix[];
  rareName?: string;
};

/**
 * An Item's name: a Rare Item's Rare name; a Magic Item's Prefix grade
 * name, then its type's name, then its Suffix grade name; a Normal Item's
 * is its type's.
 */
export function itemTitle(item: Titled): string {
  if (item.rareName) return item.rareName;
  const affixes = item.affixes ?? [];
  const prefix = affixes.find((a) => affixOf(a.kind).side === "prefix");
  const suffix = affixes.find((a) => affixOf(a.kind).side === "suffix");
  return [prefix && gradeName(prefix), itemOf(item.type).name]
    .concat(suffix ? [gradeName(suffix)] : [])
    .filter((part): part is string => !!part)
    .join(" ");
}

/**
 * What an Affix gives: the Bonus and how much, `high` being `amount` but
 * for a damage range.
 */
export function affixBonus(affix: RolledAffix): {
  bonus: Bonus;
  amount: number;
  high: number;
} {
  return {
    bonus: affixOf(affix.kind).bonus,
    amount: affix.value,
    high: affix.high ?? affix.value,
  };
}

/** The sum of the Affixes' value giving `bonus`. */
export function affixTotal(
  affixes: readonly RolledAffix[] | undefined,
  bonus: Bonus,
): number {
  let total = 0;
  for (const affix of affixes ?? []) {
    if (affixOf(affix.kind).bonus === bonus) total += affix.value;
  }
  return total;
}

/**
 * How much more the Affixes' high ends give of `bonus` than their low ends,
 * summed: 0 for an Affix with one value.
 */
export function affixSpread(
  affixes: readonly RolledAffix[] | undefined,
  bonus: Bonus,
): number {
  let total = 0;
  for (const affix of affixes ?? []) {
    if (affixOf(affix.kind).bonus === bonus) {
      total += (affix.high ?? affix.value) - affix.value;
    }
  }
  return total;
}

/** Whether `rarity` is a Rarity there is. */
export function isRarity(rarity: unknown): rarity is Rarity {
  return Object.hasOwn(rarityTuning.affixCounts, rarity as string);
}

/**
 * Whether `rarity` and `affixes` could be an Item of `type`'s: the count
 * fits the Rarity, with no Potion above Normal, a Rare name on a Rare Item
 * only, at most one Prefix and one Suffix (two of each on a Rare Item), no
 * kind twice, every kind known and suiting the type, every grade there and
 * every value a whole number inside its grade's range, a damage range's
 * high end inside its own range and not below the low end.
 */
export function isValidRoll(
  type: ItemType,
  rarity: unknown,
  affixes: unknown,
  rareName?: unknown,
): boolean {
  if (!isRarity(rarity) || !Array.isArray(affixes)) return false;
  if (isPotion(type) && rarity !== "normal") return false;
  if (rarity === "rare") {
    if (typeof rareName !== "string" || rareName.trim() === "") return false;
  } else if (rareName !== undefined) {
    return false;
  }
  const [fewest, most] = rarityTuning.affixCounts[rarity];
  if (affixes.length < fewest || affixes.length > most) return false;
  const kind = itemOf(type).kind;
  const seen: unknown[] = [];
  const perSide: Record<AffixSide, number> = { prefix: 0, suffix: 0 };
  for (const affix of affixes) {
    if (typeof affix !== "object" || affix === null) return false;
    const { kind: affixKind, grade, value } = affix as Record<string, unknown>;
    if (!AFFIX_KINDS.includes(affixKind as AffixKind)) return false;
    if (seen.includes(affixKind)) return false;
    seen.push(affixKind);
    const tuning = affixOf(affixKind as AffixKind);
    if (!tuning.rollsOn.includes(kind)) return false;
    perSide[tuning.side]++;
    if (perSide[tuning.side] > rarityTuning.perSide[rarity]) return false;
    if (!Number.isInteger(grade)) return false;
    const rolled = tuning.grades[grade as number];
    if (!rolled || !Number.isInteger(value)) return false;
    const [min, max] = rolled.range;
    if ((value as number) < min || (value as number) > max) return false;
    const { high } = affix as Record<string, unknown>;
    if (!hasDamageRange(affixKind as AffixKind)) {
      if (high !== undefined) return false;
    } else {
      const [highMin, highMax] = rolled.highRange ?? rolled.range;
      if (!Number.isInteger(high)) return false;
      if ((high as number) < highMin || (high as number) > highMax) {
        return false;
      }
      if ((high as number) < (value as number)) return false;
    }
  }
  return true;
}
