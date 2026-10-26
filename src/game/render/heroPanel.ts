import {
  hasPendingPoints,
  noPendingPoints,
  type PendingPoints,
  pendingTotal,
} from "../menus";
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
  withAttributePointsSpent,
} from "../sim/world";
import { atUiScale, type Viewport } from "../viewport";
import { type CloseButton, closeButtonRect, closeHitAt } from "./closeButton";
import { experienceBar } from "./experienceBar";
import { orbsLayout } from "./orbs";

/**
 * The Hero panel at the top left (CSS px at native scale, drawn at the UI
 * Scale): `left` and `top` from the
 * screen's corner, its rows `rowHeight` apart from `firstRow` down, and each
 * Attribute's + button `plus` square at the right of its row, its − button
 * the same size `buttonGap` to the left. Accept spans both on the unspent
 * points' row.
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
  buttonGap: 6,
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
 * The Level Up button centred over the Life orb (CSS px at native scale,
 * drawn at the UI Scale like the rest of the HUD): `overOrb` above its rim,
 * leaving room for the orb's In Combat badge between them.
 */
export const LEVEL_UP_BUTTON = { width: 96, height: 26, overOrb: 22 };

const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  vitality: "Vitality",
  energy: "Energy",
};

/**
 * What the Hero panel shows of the Hero, as text, with the Pending Attribute
 * Points counted: each value `changed` where they change it, to highlight.
 */
export type HeroSheet = {
  level: string;
  experience: string;
  attributes: {
    attribute: Attribute;
    name: string;
    value: string;
    changed: boolean;
    /** Whether it has Pending Attribute Points, so its − button shows. */
    canLower: boolean;
  }[];
  /** The unspent points left to place. */
  attributePoints: { value: string; changed: boolean };
  /** Whether a point can be placed now, so + buttons show. */
  canRaise: boolean;
  /** Whether points are pending, so Accept shows. */
  canAccept: boolean;
  /**
   * What the Attributes and Equipped Items add up to: max Life, current
   * and max Mana, the damage range, Defense, Attack Rating and the chance to hit a Skeleton of the
   * Area the Hero is in.
   */
  derived: { name: string; value: string; changed: boolean }[];
};

const NO_PENDING: Readonly<PendingPoints> = noPendingPoints();

/**
 * The Hero panel's sheet for `world` with `pending` Pending Attribute Points
 * on top, worked out by the World's own queries on the World as it would be
 * once they're accepted.
 */
export function heroSheet(
  world: World,
  pending: Readonly<PendingPoints> = NO_PENDING,
): HeroSheet {
  const { progress } = world.hero;
  const preview = withAttributePointsSpent(world, pending);
  const before = sheetValues(world);
  const after = sheetValues(preview);
  return {
    level: `Level ${progress.level}`,
    experience: experienceBar(progress.level, progress.experience).experience,
    attributes: ATTRIBUTES.map((attribute, i) => ({
      attribute,
      name: ATTRIBUTE_NAMES[attribute],
      value: after.attributes[i],
      changed: after.attributes[i] !== before.attributes[i],
      canLower: pending[attribute] > 0,
    })),
    attributePoints: {
      value: after.attributePoints,
      changed: after.attributePoints !== before.attributePoints,
    },
    canRaise: canRaise(world, pending),
    canAccept: hasPendingPoints(pending),
    derived: after.derived.map(({ name, value }, i) => ({
      name,
      value,
      changed: value !== before.derived[i].value,
    })),
  };
}

/** The values the sheet shows that Attribute Points change, as text. */
function sheetValues(world: World) {
  const [min, max] = damageRange(world);
  // As they count, with the Equipped Items' bonuses.
  const attributes = attributesOf(world);
  // A Skeleton as strong as one spawned in the Area the Hero is in.
  const skeletonHere = {
    type: "skeleton" as const,
    monsterLevel: monsterLevelIn(world.areas[world.areaName]),
  };
  return {
    attributes: ATTRIBUTES.map((attribute) => String(attributes[attribute])),
    attributePoints: String(world.hero.progress.attributePoints),
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

/**
 * Whether the + buttons are there: some unspent points aren't `pending`
 * and the Hero lives.
 */
function canRaise(world: World, pending: Readonly<PendingPoints>): boolean {
  const unspent = world.hero.progress.attributePoints;
  return unspent - pendingTotal(pending) > 0 && !world.death;
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
 * Where the panel, its × close button, its + and − buttons, Accept and the
 * Level Up button are drawn.
 */
export function heroPanelLayout(screen: Viewport): {
  panel: Rect;
  closeButton: Rect;
  raise: Record<Attribute, Rect>;
  lower: Record<Attribute, Rect>;
  accept: Rect;
  levelUp: Rect;
} {
  const { padding, plus, buttonGap, rowHeight } = atUiScale(
    HERO_PANEL,
    screen.uiScale,
  );
  const panel = heroPanelRect(screen);
  const plusX = panel.x + panel.w - padding - plus;
  const minusX = plusX - buttonGap - plus;
  /** A button `x` across on row `row`, centred in it. */
  const buttonAt = (x: number, row: number, w = plus): Rect => ({
    x,
    y: rowTop(screen, row) + (rowHeight - plus) / 2,
    w,
    h: plus,
  });
  const perAttribute = (x: number) =>
    Object.fromEntries(
      ATTRIBUTES.map((attribute, i) => [
        attribute,
        buttonAt(x, PANEL_ROWS.attributes + i),
      ]),
    ) as Record<Attribute, Rect>;
  return {
    panel,
    closeButton: closeButtonRect(panel, screen.uiScale),
    raise: perAttribute(plusX),
    lower: perAttribute(minusX),
    accept: buttonAt(minusX, PANEL_ROWS.attributePoints, plusX + plus - minusX),
    levelUp: levelUpRect(screen),
  };
}

/** Where the Level Up button is drawn, at the UI Scale. */
function levelUpRect(screen: Viewport): Rect {
  const { width, height, overOrb } = atUiScale(LEVEL_UP_BUTTON, screen.uiScale);
  const { life } = orbsLayout(screen);
  const top = life.y - life.radius - life.rim - overOrb - height;
  return { x: life.x - width / 2, y: top, w: width, h: height };
}

/** Where the Hero panel itself is drawn, at the UI Scale. */
function heroPanelRect(screen: Viewport): Rect {
  const { left, top, width, height } = atUiScale(HERO_PANEL, screen.uiScale);
  return { x: left, y: top, w: width, h: height };
}

/** The top of the panel's row `row` (CSS px), at the UI Scale. */
export function rowTop(screen: Viewport, row: number): number {
  const { firstRow, rowHeight } = atUiScale(HERO_PANEL, screen.uiScale);
  return heroPanelRect(screen).y + firstRow + row * rowHeight;
}

/**
 * A button a click can press: Level Up, an Attribute's + or −, Accept or
 * the ×.
 */
export type PanelButton =
  | { type: "levelUp" }
  | { type: "raise"; attribute: Attribute }
  | { type: "lower"; attribute: Attribute }
  | { type: "accept" }
  | CloseButton;

/**
 * A click on the open Hero panel or the Level Up button, so not for the
 * World: the button it pressed, or null between the buttons.
 */
export type PanelHit = { button: PanelButton | null };

/**
 * What a click at `point` hits, or null when it's on neither the panel nor
 * the Level Up button. The Level Up button is there only while Attribute or
 * Skill Points are unspent, pending or not; the panel only while `open`, its
 * × with it; its + buttons only while a point is left to place, each − only
 * on an Attribute with `pending` points, and Accept only while any are.
 */
export function panelHitAt(
  screen: Viewport,
  point: Vec,
  world: World,
  open: boolean,
  pending: Readonly<PendingPoints> = NO_PENDING,
): PanelHit | null {
  const layout = heroPanelLayout(screen);
  if (hasUnspentPoints(world) && inside(layout.levelUp, point)) {
    return { button: { type: "levelUp" } };
  }
  if (!open || !inside(layout.panel, point)) return null;
  const closeHit = closeHitAt(layout, point, "hero");
  if (closeHit) return closeHit;
  const raisable = canRaise(world, pending);
  for (const attribute of ATTRIBUTES) {
    if (raisable && inside(layout.raise[attribute], point)) {
      return { button: { type: "raise", attribute } };
    }
    const lowerable = pending[attribute] > 0;
    if (lowerable && inside(layout.lower[attribute], point)) {
      return { button: { type: "lower", attribute } };
    }
  }
  if (hasPendingPoints(pending) && inside(layout.accept, point)) {
    return { button: { type: "accept" } };
  }
  return { button: null };
}
