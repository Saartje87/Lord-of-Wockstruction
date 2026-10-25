import type { Vec } from "../sim/vec";
import {
  type Attribute,
  attackRating,
  damageRange,
  hitChance,
  maxLife,
  type World,
} from "../sim/world";
import { experienceBar } from "./experienceBar";

/** An axis-aligned box on the screen (CSS px). */
export type Rect = { x: number; y: number; w: number; h: number };

/**
 * The character panel at the top left (CSS px): `left` and `top` from the
 * screen's corner, its rows `rowHeight` apart from `firstRow` down, and each
 * Attribute's + button `plus` square at the right of its row.
 */
export const CHARACTER_PANEL = {
  left: 16,
  top: 16,
  width: 300,
  height: 440,
  padding: 18,
  firstRow: 56,
  rowHeight: 28,
  plus: 22,
};

/**
 * The rows of the panel under its title, in order: Level and Experience, a
 * gap, the Attributes and the unspent points, a gap, then the derived values.
 */
export const PANEL_ROWS = {
  level: 0,
  experience: 1,
  attributes: 3,
  attributePoints: 6,
  stats: 8,
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

const ATTRIBUTES: { attribute: Attribute; name: string }[] = [
  { attribute: "strength", name: "Strength" },
  { attribute: "dexterity", name: "Dexterity" },
  { attribute: "vitality", name: "Vitality" },
];

/** What the character panel shows of the Hero, as text. */
export type CharacterSheet = {
  level: string;
  experience: string;
  attributes: { attribute: Attribute; name: string; value: string }[];
  attributePoints: string;
  /** Whether there are points to spend, so + buttons show. */
  canRaise: boolean;
  /** Max Life, damage range, Attack Rating and hit chance on a Skeleton. */
  stats: { name: string; value: string }[];
};

export function characterSheet(world: World): CharacterSheet {
  const { hero } = world;
  const [min, max] = damageRange(world);
  return {
    level: `Level ${hero.level}`,
    experience: experienceBar(hero.level, hero.experience).experience,
    attributes: ATTRIBUTES.map(({ attribute, name }) => ({
      attribute,
      name,
      value: String(hero[attribute]),
    })),
    attributePoints: String(hero.attributePoints),
    canRaise: hero.attributePoints > 0,
    stats: [
      { name: "Life", value: String(maxLife(world)) },
      { name: "Damage", value: `${min}–${max}` },
      { name: "Attack Rating", value: String(attackRating(world)) },
      {
        name: "Chance to hit a Skeleton",
        value: `${Math.round(hitChance(world, "skeleton") * 100)}%`,
      },
    ],
  };
}

/** Where the panel, its + buttons and the Level Up button are drawn. */
export function characterLayout(screen: { width: number; height: number }): {
  panel: Rect;
  raise: Record<Attribute, Rect>;
  levelUp: Rect;
} {
  const P = CHARACTER_PANEL;
  const panel = { x: P.left, y: P.top, w: P.width, h: P.height };
  const plusAt = (i: number): Rect => ({
    x: panel.x + panel.w - P.padding - P.plus,
    y: rowTop(PANEL_ROWS.attributes + i) + (P.rowHeight - P.plus) / 2,
    w: P.plus,
    h: P.plus,
  });
  const B = LEVEL_UP_BUTTON;
  return {
    panel,
    raise: {
      strength: plusAt(0),
      dexterity: plusAt(1),
      vitality: plusAt(2),
    },
    levelUp: {
      x: B.left,
      y: screen.height - B.bottom - B.height,
      w: B.width,
      h: B.height,
    },
  };
}

/** The top of the panel's row `row` (CSS px). */
export function rowTop(row: number): number {
  return (
    CHARACTER_PANEL.top +
    CHARACTER_PANEL.firstRow +
    row * CHARACTER_PANEL.rowHeight
  );
}

/** What a click can press: a button, or just the open panel. */
export type PanelTarget =
  | { type: "levelUp" }
  | { type: "raise"; attribute: Attribute }
  | { type: "panel" };

/**
 * What a click at `point` would press, or null when it's on none of them, so
 * it's for the World. The Level Up and + buttons are there only while
 * `points` are unspent, and the panel and its + buttons only while `open`.
 */
export function panelTargetAt(
  screen: { width: number; height: number },
  point: Vec,
  { open, points }: { open: boolean; points: number },
): PanelTarget | null {
  const layout = characterLayout(screen);
  if (points > 0 && inside(layout.levelUp, point)) return { type: "levelUp" };
  if (!open) return null;
  if (points > 0) {
    for (const { attribute } of ATTRIBUTES) {
      if (inside(layout.raise[attribute], point)) {
        return { type: "raise", attribute };
      }
    }
  }
  return inside(layout.panel, point) ? { type: "panel" } : null;
}

function inside(rect: Rect, point: Vec): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}
