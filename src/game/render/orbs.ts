import { maxLife, maxMana, type World } from "../sim/world";

/** The Hero's two orbs: Life at the bottom left, Mana at the bottom right. */
export type Orb = "life" | "mana";

/** How full an orb shows (0..1): the Hero's current over max Life or Mana. */
export function orbFill(world: World, orb: Orb): number {
  const [current, max] =
    orb === "life"
      ? [world.hero.life, maxLife(world)]
      : [world.hero.mana, maxMana(world)];
  return Math.min(1, Math.max(0, current / max));
}
