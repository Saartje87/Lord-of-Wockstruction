import {
  beltTuning,
  ITEM_TYPES,
  type ItemType,
  isPotion,
} from "../tuning/items";
import type { Item } from "./inventory";
import type { World } from "./world";

/**
 * The Hero's Belt Columns, from the left, each listing its Potions from the
 * bottom up: the first is the one its key drinks.
 */
export type BeltColumns = Item[][];

/** The Belt Columns by Potion type, as the Save keeps them. */
export type BeltTypes = ItemType[][];

/**
 * A Belt Column cell: `row` 0 is the bottom one. Lifting from it takes the
 * Potion in that row; putting a Potion into it lands it at the column's
 * lowest free row, whatever the row.
 */
export type BeltCell = { beltColumn: number; row: number };

/** Whether a spot is a Belt Column cell. */
export function isBeltCell(spot: unknown): spot is BeltCell {
  return typeof spot === "object" && spot !== null && "beltColumn" in spot;
}

/**
 * Whether Belt Column `column` has room for one more Potion: a Held Item
 * lifted from it still counts as in it, its row kept for it.
 */
export function beltHasRoom(world: World, column: number): boolean {
  const { belt, cursor } = world.hero;
  const potions = belt[column];
  if (!potions) return false;
  const held =
    cursor && isBeltCell(cursor.from) && cursor.from.beltColumn === column
      ? 1
      : 0;
  return potions.length + held < beltRows();
}

/** The key that drinks from Belt Column `column`: "1" for the leftmost on. */
export function beltColumnKey(column: number): string {
  return String(column + 1);
}

/** Every Belt Column, empty. */
export function emptyBelt<T>(): T[][] {
  return Array.from({ length: beltTuning.columns }, () => []);
}

/** How many Potions each Belt Column holds: one row with no Belt Equipped. */
export function beltRows(): number {
  return beltTuning.rowsWithoutBelt;
}

/**
 * A New Hero's Belt Columns: `beltTuning.newHeroPotions` spread across the
 * columns from the left, a row at a time from the bottom up.
 */
export function newHeroBelt(): BeltTypes {
  const belt = emptyBelt<ItemType>();
  const { type, count } = beltTuning.newHeroPotions;
  for (let i = 0; i < count; i++) belt[i % belt.length].push(type);
  return belt;
}

/**
 * Whether stored Belt Columns could be the Hero's: one list per column, none
 * longer than the rows a column holds, holding only Potion types.
 */
export function isValidBelt(belt: unknown): belt is BeltTypes {
  if (!Array.isArray(belt) || belt.length !== beltTuning.columns) return false;
  return belt.every(
    (column) =>
      Array.isArray(column) &&
      column.length <= beltRows() &&
      column.every(
        (type) => ITEM_TYPES.includes(type as ItemType) && isPotion(type),
      ),
  );
}

/** The Belt Columns, each from the bottom up. */
export function beltOf(world: World): BeltColumns {
  return world.hero.belt.map((column) => column.map((item) => ({ ...item })));
}

/** The Belt Columns by Potion type, each from the bottom up. */
export function beltTypesOf(world: World): BeltTypes {
  return world.hero.belt.map((column) => column.map((item) => item.type));
}

/**
 * Takes the bottom Potion out of Belt Column `column`, the ones above
 * dropping down a row, or null when the column is empty or doesn't exist.
 */
export function takeFromBelt(world: World, column: number): Item | null {
  const potions = world.hero.belt[column];
  return potions?.shift() ?? null;
}
