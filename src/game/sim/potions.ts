import { itemOf, type PotionResource } from "../tuning/items";
import { takeFromBelt } from "./belt";
import type { Item } from "./inventory";
import { msToSteps } from "./units";
import type { Hero, SimEvent, World } from "./world";

export type { PotionResource };

/** The Hero's maximum of each thing a Potion gives back. */
export type PotionMaxima = Record<PotionResource, number>;

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
 * down a row, `max` being the Hero's maximum Life and Mana. Refused during
 * Death; an empty or missing column does nothing.
 */
export function drinkFromBelt(
  world: World,
  column: number,
  max: PotionMaxima,
  events: SimEvent[],
) {
  if (world.death) return;
  const potion = takeFromBelt(world, column);
  if (!potion) return;
  drink(world.hero, potion, max, events);
  events.push({ type: "BeltChanged" });
}

/**
 * Drinks a Potion already taken out of where it was: an at-once Potion gives
 * its share of each maximum in `max` there and then, capped at it; any other
 * starts its effect, which runs its own course whatever else is running.
 * Drunk at full Life it is used up all the same.
 */
function drink(
  hero: Hero,
  potion: Item,
  max: PotionMaxima,
  events: SimEvent[],
) {
  const effect = itemOf(potion.type).potion;
  if (effect?.type === "atOnce") {
    for (const resource of effect.resources) {
      hero[resource] = Math.min(
        max[resource],
        hero[resource] + effect.share * max[resource],
      );
    }
  } else if (effect) {
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
export function stepPotionEffects(hero: Hero, max: PotionMaxima) {
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
