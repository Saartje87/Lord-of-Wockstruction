import { itemOf } from "../tuning/items";
import { QUEST_IDS, questTuning } from "../tuning/quests";
import { smithTuning } from "../tuning/smith";
import { EQUIPMENT_SLOTS, type Item, type ItemId } from "./inventory";
import type { QuestLog } from "./quests";
import { randomInt } from "./random";
import type { SimEvent, World } from "./world";

/** The Smith's name in the maps. */
export const SMITH = "Smith";

/** Whether the Quest that unlocks the Smith's service is Done. */
export function smithQuestDone(quests: QuestLog): boolean {
  return QUEST_IDS.some(
    (id) =>
      questTuning[id].reward.type === "smithService" &&
      quests[id].state === "done",
  );
}

/** Whether the Smith can work `item`: a Weapon or Armour without his bonus yet. */
export function canSmith(item: Item): boolean {
  const { kind } = itemOf(item.type);
  return (kind === "weapon" || kind === "armour") && !item.smithBonus;
}

/**
 * The Items the Smith could work, Equipped ones first and then the
 * Inventory's: copies, so a query's answer can't change the World.
 */
export function smithableItems(
  world: World,
): { item: Item; equipped: boolean }[] {
  const worn = EQUIPMENT_SLOTS.flatMap((slot) => {
    const item = world.hero.equipment[slot];
    return item ? [{ item, equipped: true }] : [];
  });
  const carried = world.hero.inventory.map(({ item }) => ({
    item,
    equipped: false,
  }));
  return [...worn, ...carried]
    .filter(({ item }) => canSmith(item))
    .map(({ item, equipped }) => ({ item: { ...item }, equipped }));
}

/**
 * Gives the Item `itemId` one random bonus from the pool of its kind, using
 * the service up, if it is unlocked and unspent and the Item can be worked.
 */
export function giveSmithBonus(
  world: World,
  itemId: ItemId,
  events: SimEvent[],
) {
  const { progress } = world.hero;
  if (progress.smithService !== "unlocked") return;
  const item = [
    ...Object.values(world.hero.equipment),
    ...world.hero.inventory.map((placed) => placed.item),
  ].find((candidate) => candidate?.id === itemId);
  if (!item || !canSmith(item)) return;
  const pool = smithTuning[itemOf(item.type).kind as "weapon" | "armour"];
  const entry = pool[randomInt(world.rng, [0, pool.length - 1])];
  item.smithBonus = {
    bonus: entry.bonus,
    amount: randomInt(world.rng, entry.amount),
  };
  progress.smithService = "used";
  events.push({
    type: "SmithBonusGiven",
    item: itemId,
    bonus: { ...item.smithBonus },
  });
}
