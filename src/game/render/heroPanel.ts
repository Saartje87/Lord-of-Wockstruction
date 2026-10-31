import {
  hasPendingPoints,
  noPendingPoints,
  type PendingPoints,
  pendingTotal,
} from "../menus";
import { inside, middleOf, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import {
  ATTRIBUTES,
  type Attribute,
  attackRating,
  attributesOf,
  damageRange,
  heroBlockChance,
  heroChanceToHit,
  heroDefense,
  heroResistance,
  maxLife,
  maxMana,
  monsterLevelIn,
  type World,
  withAttributePointsSpent,
} from "../sim/world";
import { ELEMENTS, type Element, MAXIMUM_RESISTANCE } from "../tuning/damage";
import { atUiScale, type Viewport } from "../viewport";
import { type CloseButton, closeButtonRect, closeHitAt } from "./closeButton";
import { compactPanelRect } from "./compactLayout";
import { experienceBar } from "./experienceBar";
import { orbsLayout } from "./orbs";

/**
 * The Hero panel at the top left (CSS px at native scale, drawn at the UI
 * Scale): `left` and `top` from the
 * screen's corner, its rows `rowHeight` apart from `firstRow` down, and each
 * Attribute's + button `plus` square at the right of its row, its − button
 * the same size `buttonGap` to the left. Accept spans both on the unspent
 * points' row. Its close hint sits `hintHeight` tall at its bottom, inside
 * its padding.
 */
export const HERO_PANEL = {
  left: 16,
  top: 16,
  width: 300,
  height: 524,
  padding: 18,
  firstRow: 56,
  rowHeight: 28,
  derivedRowHeight: 18,
  plus: 22,
  buttonGap: 6,
  hintHeight: 20,
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
  derived: {
    name: string;
    value: string;
    changed: boolean;
    /** The Element of a Resistance line, which is drawn in its colour. */
    element?: Element;
  }[];
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
    derived: after.derived.map(({ name, value, element }, i) => ({
      name,
      value,
      changed: value !== before.derived[i].value,
      ...(element && { element }),
    })),
  };
}

const ELEMENT_NAMES: Record<Element, string> = {
  fire: "Fire",
  cold: "Cold",
  lightning: "Lightning",
};

/** A Resistance line's value: the effective Resistance, marked when the total is over the cap. */
function resistanceText(world: World, element: Element): string {
  const { total, effective } = heroResistance(world, element);
  return total > effective && effective >= MAXIMUM_RESISTANCE
    ? `${effective}% (capped)`
    : `${effective}%`;
}

/** The values the sheet shows that Attribute Points change, as text. */
function sheetValues(world: World): {
  attributes: string[];
  attributePoints: string;
  derived: { name: string; value: string; element?: Element }[];
} {
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
      ...ELEMENTS.map((element) => ({
        name: `${ELEMENT_NAMES[element]} Resistance`,
        value: resistanceText(world, element),
        element,
      })),
      { name: "Block", value: `${heroBlockChance(world)}%` },
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
export function canRaise(
  world: World,
  pending: Readonly<PendingPoints>,
): boolean {
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
 * Where the panel, its × close button, its close hint, its + and − buttons,
 * Accept and the Level Up button are drawn.
 */
export function heroPanelLayout(screen: Viewport): {
  panel: Rect;
  closeButton: Rect;
  closeHint: Rect;
  raise: Record<Attribute, Rect>;
  lower: Record<Attribute, Rect>;
  accept: Rect;
  levelUp: Rect;
} {
  const { plus, buttonGap, rowHeight, padding, hintHeight } = atUiScale(
    HERO_PANEL,
    screen.uiScale,
  );
  const panel = heroPanelRect(screen);
  // The Attributes' rows all share one column.
  const column = heroPanelRow(screen, PANEL_ROWS.attributes);
  const plusX = column.x + column.w - plus;
  const minusX = plusX - buttonGap - plus;
  /** A button `x` across on row `row`, centred in it. */
  const buttonAt = (x: number, row: number, w = plus): Rect => ({
    x,
    y: heroPanelRow(screen, row).y + (rowHeight - plus) / 2,
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
    closeHint: {
      x: panel.x + padding,
      y: panel.y + panel.h - padding - hintHeight,
      w: panel.w - 2 * padding,
      h: hintHeight,
    },
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

/**
 * Where the Hero panel itself is drawn, at the UI Scale: at the top left,
 * or in the Compact Layout filling the screen.
 */
function heroPanelRect(screen: Viewport): Rect {
  if (screen.compact) return compactPanelRect(screen);
  const { left, top, width, height } = atUiScale(HERO_PANEL, screen.uiScale);
  return { x: left, y: top, w: width, h: height };
}

/**
 * Where the panel's row `row` is drawn (CSS px), at the UI Scale: its name
 * goes at its left and its value at its right. The rows run down the panel
 * inside its padding; in the Compact Layout, too short for them all, what
 * the Attributes add up to goes in a second column from the top row down,
 * clear of the close hint at the bottom on a screen as short as 320 px.
 */
export function heroPanelRow(screen: Viewport, row: number): Rect {
  const { width, padding, firstRow, rowHeight, derivedRowHeight } = atUiScale(
    HERO_PANEL,
    screen.uiScale,
  );
  const panel = heroPanelRect(screen);
  const top = (at: number) => panel.y + firstRow + at * rowHeight;
  if (!screen.compact) {
    // What the Attributes add up to is set closer, to fit its many lines.
    const derived = row >= PANEL_ROWS.derived;
    return {
      x: panel.x + padding,
      y: derived
        ? top(PANEL_ROWS.derived) +
          (row - PANEL_ROWS.derived) * derivedRowHeight
        : top(row),
      w: width - 2 * padding,
      h: derived ? derivedRowHeight : rowHeight,
    };
  }
  // Two columns as wide as the panel's own, centred, a padding apart.
  const column = width - 2 * padding;
  const left = panel.x + (panel.w - 2 * column - padding) / 2;
  if (row < PANEL_ROWS.derived) {
    return { x: left, y: top(row), w: column, h: rowHeight };
  }
  return {
    x: left + column + padding,
    y: top(PANEL_ROWS.level) + (row - PANEL_ROWS.derived) * derivedRowHeight,
    w: column,
    h: derivedRowHeight,
  };
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
 * What a click at `point` hits of the Level Up button, there only while
 * Attribute or Skill Points are unspent, pending or not, or null off it. The
 * open Hero panel is drawn over it, and covers it in the Compact Layout.
 */
export function levelUpHitAt(
  screen: Viewport,
  point: Vec,
  world: World,
): PanelHit | null {
  const { levelUp } = heroPanelLayout(screen);
  if (!hasUnspentPoints(world) || !inside(levelUp, point)) return null;
  return { button: { type: "levelUp" } };
}

/**
 * What a click at `point` hits of the Hero panel, there only while `open`,
 * or null off it: its ×; its + buttons only while a point is left to place,
 * each − only on an Attribute with `pending` points, and Accept only while
 * any are.
 */
export function heroPanelHitAt(
  screen: Viewport,
  point: Vec,
  world: World,
  open: boolean,
  pending: Readonly<PendingPoints> = NO_PENDING,
): PanelHit | null {
  const layout = heroPanelLayout(screen);
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

/** A spot on the Hero panel the Focus can rest on: a button shown on it. */
export type HeroFocusSpot = { rect: Rect; at: Vec; hit: PanelHit };

/**
 * The Hero panel's Focus spots, for `pending` points: each + and − button,
 * Accept and the ×, only while they're shown, each clicked at its middle.
 */
export function heroFocusSpots(
  world: World,
  screen: Viewport,
  pending: Readonly<PendingPoints> = NO_PENDING,
): HeroFocusSpot[] {
  const layout = heroPanelLayout(screen);
  const spots: HeroFocusSpot[] = [];
  const add = (rect: Rect, button: PanelButton) => {
    spots.push({ rect, at: middleOf(rect), hit: { button } });
  };
  const raisable = canRaise(world, pending);
  for (const attribute of ATTRIBUTES) {
    if (pending[attribute] > 0) {
      add(layout.lower[attribute], { type: "lower", attribute });
    }
    if (raisable) add(layout.raise[attribute], { type: "raise", attribute });
  }
  if (hasPendingPoints(pending)) add(layout.accept, { type: "accept" });
  add(layout.closeButton, { type: "close", panel: "hero" });
  return spots;
}
