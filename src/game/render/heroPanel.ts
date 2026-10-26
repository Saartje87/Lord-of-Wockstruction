import type { Panel } from "../menus";
import { inside, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import {
  ATTRIBUTES,
  type Attribute,
  attackRating,
  attributesOf,
  damageRange,
  heroChanceToHit,
  heroDefense,
  maxLife,
  maxMana,
  monsterLevelIn,
  type World,
} from "../sim/world";
import { closeButtonRect } from "./closeButton";
import { experienceBar } from "./experienceBar";

/**
 * The Hero panel at the top left (CSS px): `left` and `top` from the
 * screen's corner, its rows `rowHeight` apart from `firstRow` down, and each
 * Attribute's + button `plus` square at the right of its row.
 */
export const HERO_PANEL = {
  left: 16,
  top: 16,
  width: 300,
  height: 524,
  padding: 18,
  firstRow: 56,
  rowHeight: 28,
  plus: 22,
};

/**
 * The rows of the panel under its title, in order: Level and Experience, a
 * gap, the Attributes and the unspent points, a gap, then what the
 * Attributes add up to.
 */
export const PANEL_ROWS = {
  level: 0,
  experience: 1,
  attributes: 3,
  attributePoints: 3 + ATTRIBUTES.length,
  derived: 5 + ATTRIBUTES.length,
} as const;

/**
 * The Level Up button over the strip, just right of the Life orb (CSS px):
 * `left` and `bottom` from the screen's corner.
 */
export const LEVEL_UP_BUTTON = {
  left: 160,
  bottom: 44,
  width: 96,
  height: 26,
};

const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  vitality: "Vitality",
  energy: "Energy",
};

/** What the Hero panel shows of the Hero, as text. */
export type HeroSheet = {
  level: string;
  experience: string;
  attributes: { attribute: Attribute; name: string; value: string }[];
  attributePoints: string;
  /** Whether a point can be spent now, so + buttons show. */
  canRaise: boolean;
  /**
   * What the Attributes and Equipped Items add up to: max Life, current
   * and max Mana, the damage range, Defense, Attack Rating and the chance to hit a Skeleton of the
   * Area the Hero is in.
   */
  derived: { name: string; value: string }[];
};

export function heroSheet(world: World): HeroSheet {
  const { progress } = world.hero;
  const [min, max] = damageRange(world);
  // As they count, with the Equipped Items' bonuses.
  const attributes = attributesOf(world);
  // A Skeleton as strong as one spawned in the Area the Hero is in.
  const skeletonHere = {
    type: "skeleton" as const,
    monsterLevel: monsterLevelIn(world.areas[world.areaName]),
  };
  return {
    level: `Level ${progress.level}`,
    experience: experienceBar(progress.level, progress.experience).experience,
    attributes: ATTRIBUTES.map((attribute) => ({
      attribute,
      name: ATTRIBUTE_NAMES[attribute],
      value: String(attributes[attribute]),
    })),
    attributePoints: String(progress.attributePoints),
    canRaise: canRaise(world),
    derived: [
      { name: "Life", value: String(maxLife(world)) },
      {
        name: "Mana",
        value: `${Math.floor(world.hero.mana)} / ${maxMana(world)}`,
      },
      // Each hit rounds its own damage, so the range shows rounded too.
      { name: "Damage", value: `${Math.round(min)}–${Math.round(max)}` },
      { name: "Defense", value: String(heroDefense(world)) },
      { name: "Attack Rating", value: String(attackRating(world)) },
      {
        name: "Chance to hit a Skeleton",
        value: `${Math.round(heroChanceToHit(world, skeletonHere) * 100)}%`,
      },
    ],
  };
}

/** Whether the + buttons are there: points are unspent and the Hero lives. */
function canRaise(world: World): boolean {
  return world.hero.progress.attributePoints > 0 && !world.death;
}

/**
 * Whether Attribute Points or Skill Points are unspent, so the Level Up
 * button is there.
 */
export function hasUnspentPoints(world: World): boolean {
  const { attributePoints, skillPoints } = world.hero.progress;
  return attributePoints > 0 || skillPoints > 0;
}

/**
 * Where the panel, its × close button, its + buttons and the Level Up button
 * are drawn.
 */
export function heroPanelLayout(screen: { width: number; height: number }): {
  panel: Rect;
  close: Rect;
  raise: Record<Attribute, Rect>;
  levelUp: Rect;
} {
  const panel = {
    x: HERO_PANEL.left,
    y: HERO_PANEL.top,
    w: HERO_PANEL.width,
    h: HERO_PANEL.height,
  };
  const plusAt = (i: number): Rect => ({
    x: panel.x + panel.w - HERO_PANEL.padding - HERO_PANEL.plus,
    y:
      rowTop(PANEL_ROWS.attributes + i) +
      (HERO_PANEL.rowHeight - HERO_PANEL.plus) / 2,
    w: HERO_PANEL.plus,
    h: HERO_PANEL.plus,
  });
  return {
    panel,
    close: closeButtonRect(panel),
    raise: Object.fromEntries(
      ATTRIBUTES.map((attribute, i) => [attribute, plusAt(i)]),
    ) as Record<Attribute, Rect>,
    levelUp: {
      x: LEVEL_UP_BUTTON.left,
      y: screen.height - LEVEL_UP_BUTTON.bottom - LEVEL_UP_BUTTON.height,
      w: LEVEL_UP_BUTTON.width,
      h: LEVEL_UP_BUTTON.height,
    },
  };
}

/** The top of the panel's row `row` (CSS px). */
export function rowTop(row: number): number {
  return HERO_PANEL.top + HERO_PANEL.firstRow + row * HERO_PANEL.rowHeight;
}

/** A panel's × close button, which shuts it as its key does. */
export type CloseButton = { type: "close"; panel: Panel };

/** A button a click can press: Level Up, an Attribute's + or the ×. */
export type PanelButton =
  | { type: "levelUp" }
  | { type: "raise"; attribute: Attribute }
  | CloseButton;

/**
 * A click on the open Hero panel or the Level Up button, so not for the
 * World: the button it pressed, or null between the buttons.
 */
export type PanelHit = { button: PanelButton | null };

/**
 * What a click at `point` hits, or null when it's on neither the panel nor
 * the Level Up button, so it's for the World. The Level Up button is there
 * only while Attribute or Skill Points are unspent, the panel only while
 * `open`, its × with it, and its + buttons only while a point can be spent.
 */
export function panelHitAt(
  screen: { width: number; height: number },
  point: Vec,
  world: World,
  open: boolean,
): PanelHit | null {
  const layout = heroPanelLayout(screen);
  if (hasUnspentPoints(world) && inside(layout.levelUp, point)) {
    return { button: { type: "levelUp" } };
  }
  if (!open || !inside(layout.panel, point)) return null;
  if (inside(layout.close, point)) {
    return { button: { type: "close", panel: "hero" } };
  }
  if (canRaise(world)) {
    for (const attribute of ATTRIBUTES) {
      if (inside(layout.raise[attribute], point)) {
        return { button: { type: "raise", attribute } };
      }
    }
  }
  return { button: null };
}
