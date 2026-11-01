import { monsterMaxLife } from "../sim/monsters";
import type { Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import type { Minion, MinionId, Monster, MonsterId, World } from "../sim/world";
import { minionTuning } from "../tuning/minions";
import { monsterTuning } from "../tuning/monsters";
import { atUiScale, type Viewport } from "../viewport";

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
export type Nameplate = {
  name: string;
  fraction: number;
  friendly: boolean;
  /** Whether it is a Unique Monster, whose name is drawn in the Unique gold. */
  unique: boolean;
};

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
  gap: 4,
};

/**
 * Where the nameplate's panel and Life bar are drawn, where its name's top
 * centre goes, and how big the name is. With a `below` above 0 (the bottom
 * of the Boss bar) the panel sits `gap` under that instead of at the top.
 */
export function nameplateLayout(
  screen: Viewport,
  below = 0,
): {
  panel: Rect;
  bar: Rect;
  nameAt: Vec;
  nameSize: number;
} {
  const sizes = atUiScale(NAMEPLATE, screen.uiScale);
  const centre = screen.width / 2;
  const panel = {
    x: centre - sizes.width / 2,
    y: below > 0 ? below + sizes.gap : sizes.top,
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
      fraction: minion.life / minion.maxLife,
      friendly: true,
      unique: false,
    };
  }
  const { monster } = hovered;
  return {
    name: monster.unique ?? monsterTuning[monster.type].name,
    fraction: monster.life / monsterMaxLife(monster),
    friendly: false,
    unique: monster.unique !== null,
  };
}
