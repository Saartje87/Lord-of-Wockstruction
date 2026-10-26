import {
  beltTuning,
  ITEM_TYPES,
  type ItemType,
  isPotion,
  itemOf,
} from "../tuning/items";
import {
  type EquipmentSlot,
  firstFreeCell,
  type Item,
  type PlacedItem,
  type PlacedType,
} from "./inventory";
import type { Hero, SimEvent, World } from "./world";

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

/** The key that drinks from Belt Column `column`: "1" for the leftmost on. */
export function beltColumnKey(column: number): string {
  return String(column + 1);
}

/** Every Belt Column, empty. */
export function emptyBelt<T>(): T[][] {
  return Array.from({ length: beltTuning.columns }, () => []);
}

/**
 * How many Potions each Belt Column holds: the Equipped Belt's rows, or
 * `beltTuning.rowsWithoutBelt` with none.
 */
export function beltRows(world: World): number {
  return rowsOf(world.hero.equipment.belt?.type);
}

/** The rows a Belt of `type` gives, or those with no Belt for none. */
export function rowsOf(type: ItemType | undefined): number {
  return (type && itemOf(type).beltRows) || beltTuning.rowsWithoutBelt;
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
 * longer than `rows`, holding only Potion types.
 */
export function isValidBelt(belt: unknown, rows: number): belt is BeltTypes {
  if (!Array.isArray(belt) || belt.length !== beltTuning.columns) return false;
  return belt.every(
    (column) =>
      Array.isArray(column) &&
      column.length <= rows &&
      column.every(
        (type) => ITEM_TYPES.includes(type as ItemType) && isPotion(type),
      ),
  );
}

/** The Belt Columns, each from the bottom up. */
export function beltOf(world: World): BeltColumns {
  return world.hero.belt.map((column) => column.map((item) => ({ ...item })));
}

/**
 * The Belt Columns' Potions, each from the bottom up, with a Held Item
 * lifted from the Belt back at its row.
 */
export function beltItemsOf(hero: Hero): Item[][] {
  const { belt, cursor } = hero;
  return belt.map((column, index) => {
    const items = [...column];
    if (cursor && isBeltCell(cursor.from)) {
      const { beltColumn, row } = cursor.from;
      if (beltColumn === index) items.splice(row, 0, cursor.item);
    }
    return items;
  });
}

/**
 * The Belt Columns by Potion type, each from the bottom up, as the Save
 * keeps them: a Held Item lifted from the Belt is back at its row.
 */
export function beltTypesOf(world: World): BeltTypes {
  return beltItemsOf(world.hero).map((column) =>
    column.map((item) => item.type),
  );
}

/**
 * Takes the bottom Potion out of Belt Column `column`, the ones above
 * dropping down a row, or null when the column is empty or doesn't exist.
 */
export function takeFromBelt(world: World, column: number): Item | null {
  const potions = world.hero.belt[column];
  return potions?.shift() ?? null;
}

/**
 * Puts a picked-up Potion into a Belt Column, returning which, or null when
 * it isn't a Potion or no column takes it.
 */
export function putInBelt(world: World, item: Item): number | null {
  if (!isPotion(item.type)) return null;
  const column = beltColumnFor(world, item.type);
  if (column !== null) world.hero.belt[column].push(item);
  return column;
}

/**
 * The Belt Column a picked-up Potion of `type` goes into: the leftmost with
 * room whose bottom Potion is the same type, else the leftmost empty one, or
 * null when neither is there. A Held Item lifted from the Belt counts as
 * still in its column, so its row stays kept for it.
 */
function beltColumnFor(world: World, type: ItemType): number | null {
  const belt = beltTypesOf(world);
  const rows = beltRows(world);
  const sameType = belt.findIndex(
    (column) => column.length < rows && column[0] === type,
  );
  if (sameType !== -1) return sameType;
  const empty = belt.findIndex((column) => column.length === 0);
  return empty === -1 ? null : empty;
}

/** Potions moving out of Belt rows that no longer exist, each to its cell. */
export type Overflow = PlacedItem[];

/**
 * What putting `type` (or nothing) into `slot` moves out of the Belt: for
 * the Belt slot, where the Potions in rows its Belt doesn't have go in the
 * Inventory, each to the first free spot among `placed` and those before
 * it, or null when they can't all fit. Other slots move none.
 */
export function overflowFor(
  hero: Hero,
  slot: EquipmentSlot,
  type: ItemType | null,
  placed: readonly PlacedType[],
): Overflow | null {
  if (slot !== "belt") return [];
  const rows = rowsOf(type ?? undefined);
  const overflow: Overflow = [];
  const filled = [...placed];
  for (const column of beltItemsOf(hero)) {
    for (const item of column.slice(rows)) {
      const cell = firstFreeCell(filled, item.type);
      if (!cell) return null;
      filled.push({ type: item.type, cell });
      overflow.push({ item, cell });
    }
  }
  return overflow;
}

/**
 * Moves the Potions of `overflow` out of the Belt into their Inventory
 * cells; a Held Item lifted from one of their rows goes back to its cell
 * instead.
 */
export function moveOverflow(
  hero: Hero,
  overflow: Overflow,
  events: SimEvent[],
) {
  if (overflow.length === 0) return;
  for (const { item, cell } of overflow) {
    if (hero.cursor?.item === item) {
      hero.cursor.from = { ...cell };
      continue;
    }
    for (const column of hero.belt) {
      const index = column.indexOf(item);
      if (index !== -1) column.splice(index, 1);
    }
    hero.inventory.push({ item, cell: { ...cell } });
  }
  events.push({ type: "BeltChanged" });
}
