import { isPotion, itemOf } from "../tuning/items";
import { takeFromBelt } from "./belt";
import type { Item, ItemId } from "./inventory";
import { msToSteps } from "./units";
import type { Hero, SimEvent, World } from "./world";

/** What a Potion gives back. */
export type PotionResource = "life" | "mana";

/**
 * A drunk Potion still running its course: `perStep` of `resource` each step
 * for `stepsLeft` more steps. Each runs alongside any others.
 */
export type PotionEffect = {
  resource: PotionResource;
  perStep: number;
  stepsLeft: number;
};

/** A running Potion effect as shown: what it gives back and how much is left. */
export type RunningPotion = { resource: PotionResource; left: number };

/**
 * Drinks the bottom Potion of Belt Column `column`, the ones above dropping
 * down a row. Refused during Death; an empty or missing column does nothing.
 */
export function drinkFromBelt(
  world: World,
  column: number,
  events: SimEvent[],
) {
  if (world.death) return;
  const potion = takeFromBelt(world, column);
  if (!potion) return;
  drink(world.hero, potion, events);
  events.push({ type: "BeltChanged" });
}

/**
 * Drinks the Potion `id` in the Inventory, using it up. Refused during
 * Death; an Item that isn't a Potion in the Inventory does nothing.
 */
export function drinkItem(world: World, id: ItemId, events: SimEvent[]) {
  const { hero } = world;
  if (world.death) return;
  const placed = hero.inventory.find(({ item }) => item.id === id);
  if (!placed || !isPotion(placed.item.type)) return;
  hero.inventory = hero.inventory.filter((other) => other !== placed);
  drink(hero, placed.item, events);
  events.push({ type: "InventoryChanged" });
}

/**
 * Drinks a Potion already taken out of where it was, starting its effect,
 * which runs its own course whatever else is running. Drunk at full Life it
 * is used up all the same.
 */
function drink(hero: Hero, potion: Item, events: SimEvent[]) {
  const effect = itemOf(potion.type).potion;
  if (effect) {
    const steps = Math.max(1, msToSteps(effect.durationMs));
    hero.potionEffects.push({
      resource: effect.resource,
      perStep: effect.amount / steps,
      stepsLeft: steps,
    });
  }
  events.push({ type: "PotionDrunk", item: { ...potion } });
}

/**
 * Gives one step of every running Potion effect, each capped at the Hero's
 * maximum in `max`, dropping the ones that have run their course.
 */
export function stepPotionEffects(
  hero: Hero,
  max: Record<PotionResource, number>,
) {
  for (const effect of hero.potionEffects) {
    hero[effect.resource] = Math.min(
      max[effect.resource],
      hero[effect.resource] + effect.perStep,
    );
    effect.stepsLeft -= 1;
  }
  hero.potionEffects = hero.potionEffects.filter(
    (effect) => effect.stepsLeft > 0,
  );
}

/** The Potion effects still running, oldest first. */
export function potionEffectsOf(world: World): RunningPotion[] {
  return world.hero.potionEffects.map(({ resource, perStep, stepsLeft }) => ({
    resource,
    left: perStep * stepsLeft,
  }));
}
