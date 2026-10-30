import type { ItemType, Rarity } from "../tuning/items";
import { valueTuning } from "../tuning/vendor";
import type { RolledAffix } from "./affixes";

/**
 * What an Item is worth in Gold: its type's base Value, raised by its Rarity
 * and by a share for each Affix, more for higher grades; a whole number.
 */
export function itemValue(item: {
  type: ItemType;
  rarity?: Rarity;
  affixes?: readonly RolledAffix[];
}): number {
  const { base, rarity, affixShare } = valueTuning;
  const shares = (item.affixes ?? []).reduce(
    (sum, { grade }) => sum + (affixShare[grade] ?? affixShare.at(-1) ?? 0),
    0,
  );
  return Math.round(
    base[item.type] * rarity[item.rarity ?? "normal"] * (1 + shares),
  );
}
