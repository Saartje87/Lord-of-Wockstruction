import { minionMaxLife } from "../sim/minions";
import { monsterMaxLife } from "../sim/monsters";
import type { Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import type { Minion, MinionId, Monster, MonsterId, World } from "../sim/world";
import { minionTuning } from "../tuning/minions";
import { monsterTuning } from "../tuning/monsters";
import { atUiScale, type Viewport } from "../viewport";

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

/** A hovered Monster, or one of the Hero's Minions hovered. */
export type Hovered = { monster: Monster } | { minion: Minion };

/** A character the pointer can be over: a Monster, or one of the Minions. */
export type CharacterId = MonsterId | { minion: MinionId };

/**
 * What is outlined and named as hovered: the character `pointed` at by the
 * pointer, else the Target auto-aim picked; null for neither, or for one no
 * longer among the living.
 */
export function hoveredOf(
  world: World,
  pointed: CharacterId | null,
  target: MonsterId | null,
): Hovered | null {
  if (typeof pointed === "object" && pointed !== null) {
    const minion = world.minions.find((one) => one.id === pointed.minion);
    return minion ? { minion } : null;
  }
  const id = pointed ?? target;
  const monster = world.monsters.find((one) => one.id === id);
  return monster ? { monster } : null;
}

/**
 * What the top-centre nameplate shows for a hovered character: its name, how
 * full its Life bar is (0..1), and whether it is on the Hero's side.
 */
export type Nameplate = { name: string; fraction: number; friendly: boolean };

/**
 * The top-centre nameplate (CSS px at native scale, drawn at the UI Scale):
 * a panel `top` from the screen's top with the name `nameSize` tall
 * `nameTop` below its top, and a Life bar `barHeight` tall `barBottom`
 * above its bottom.
 */
export const NAMEPLATE = {
  width: 220,
  height: 46,
  top: 10,
  nameTop: 6,
  nameSize: 16,
  bar: 180,
  barHeight: 8,
  barBottom: 8,
};

/**
 * Where the nameplate's panel and Life bar are drawn, where its name's top
 * centre goes, and how big the name is.
 */
export function nameplateLayout(screen: Viewport): {
  panel: Rect;
  bar: Rect;
  nameAt: Vec;
  nameSize: number;
} {
  const sizes = atUiScale(NAMEPLATE, screen.uiScale);
  const centre = screen.width / 2;
  const panel = {
    x: centre - sizes.width / 2,
    y: sizes.top,
    w: sizes.width,
    h: sizes.height,
  };
  return {
    panel,
    bar: {
      x: centre - sizes.bar / 2,
      y: panel.y + panel.h - sizes.barHeight - sizes.barBottom,
      w: sizes.bar,
      h: sizes.barHeight,
    },
    nameAt: { x: centre, y: panel.y + sizes.nameTop },
    nameSize: sizes.nameSize,
  };
}

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
