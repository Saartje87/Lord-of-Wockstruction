import { minionMaxLife } from "../sim/minions";
import { monsterMaxLife } from "../sim/monsters";
import type { Vec } from "../sim/vec";
import type { Minion, Monster } from "../sim/world";
import { minionTuning } from "../tuning/minions";
import { monsterTuning } from "../tuning/monsters";

/**
 * The box a character is picked by, around its feet at native scale (CSS
 * px): about where its art is drawn.
 */
export const CHARACTER_BOX = { left: -35, right: 35, top: -135, bottom: 15 };

/** A character drawn with its feet at `at` (CSS px), `scale` times native. */
export type Pickable<Id> = { id: Id; at: Vec; scale: number };

/**
 * The character whose box is under `point` (CSS px), the one in front, lowest
 * on screen, where boxes overlap; null over none.
 */
export function characterUnder<Id>(
  characters: readonly Pickable<Id>[],
  point: Vec,
): Id | null {
  let front: Pickable<Id> | null = null;
  for (const character of characters) {
    const dx = (point.x - character.at.x) / character.scale;
    const dy = (point.y - character.at.y) / character.scale;
    const inside =
      dx >= CHARACTER_BOX.left &&
      dx <= CHARACTER_BOX.right &&
      dy >= CHARACTER_BOX.top &&
      dy <= CHARACTER_BOX.bottom;
    if (inside && (!front || character.at.y > front.at.y)) front = character;
  }
  return front?.id ?? null;
}

/** A hovered Monster, or the Hero's hovered Minion. */
export type Hovered = { monster: Monster } | { minion: Minion };

/**
 * What the top-centre nameplate shows for a hovered character: its name, how
 * full its Life bar is (0..1), and whether it is on the Hero's side.
 */
export type Nameplate = { name: string; fraction: number; friendly: boolean };

/** The nameplate of a hovered Monster or Minion. */
export function nameplateOf(hovered: Hovered): Nameplate {
  if ("minion" in hovered) {
    const { minion } = hovered;
    return {
      name: minionTuning[minion.type].name,
      fraction: minion.life / minionMaxLife(minion),
      friendly: true,
    };
  }
  const { monster } = hovered;
  return {
    name: monsterTuning[monster.type].name,
    fraction: monster.life / monsterMaxLife(monster),
    friendly: false,
  };
}
