import {
  ITEM_TYPES,
  type ItemKind,
  type ItemType,
  inventoryTuning,
  itemTuning,
} from "../tuning/items";

/** Unique within the World and never reused. */
export type ItemId = number;

/** One Item: its type says everything about it but which one it is. */
export type Item = { id: ItemId; type: ItemType };

/** An Inventory cell, counted from the top-left. */
export type Cell = { column: number; row: number };

/** An Item in the Inventory, with `cell` its top-left cell. */
export type PlacedItem = { item: Item; cell: Cell };

/** Where an Item can be: an Inventory cell (its top-left) or an Equipment slot. */
export type ItemSpot = Cell | EquipmentSlot;

/** Whether a spot is an Equipment slot rather than a cell. */
export function isSlot(spot: ItemSpot): spot is EquipmentSlot {
  return typeof spot === "string";
}

/**
 * The Item held on the cursor, with `from` the top-left cell or the slot it
 * goes back to if it's never put down, kept free for it all the while it's
 * held.
 */
export type CursorItem = { item: Item; from: ItemSpot };

/** The Hero's Equipment slots, in the order they're listed. */
export const EQUIPMENT_SLOTS = [
  "weapon",
  "armour",
  "amulet",
  "ring1",
  "ring2",
] as const;

/** One of the Hero's Equipment slots. */
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

/** What's in each Equipment slot, null when empty. */
export type Equipment = Record<EquipmentSlot, Item | null>;

/** The Item kind each slot takes. */
export const SLOT_KINDS: Record<EquipmentSlot, ItemKind> = {
  weapon: "weapon",
  armour: "armour",
  amulet: "amulet",
  ring1: "ring",
  ring2: "ring",
};

/**
 * The Hero's Inventory and Equipment by Item type, as the Save keeps them:
 * Item ids are handed out afresh when a World is made from it.
 */
export type Gear = {
  inventory: { type: ItemType; cell: Cell }[];
  equipment: Partial<Record<EquipmentSlot, ItemType>>;
};

/** A New Hero's gear: a Short Sword Equipped and an empty Inventory. */
export const FRESH_GEAR: Gear = {
  inventory: [],
  equipment: { weapon: "shortSword" },
};

/** Whether an Item of `type` with its top-left at `at` covers `cell`. */
export function covers(type: ItemType, at: Cell, cell: Cell): boolean {
  const { columns, rows } = itemTuning[type].size;
  return (
    cell.column >= at.column &&
    cell.column < at.column + columns &&
    cell.row >= at.row &&
    cell.row < at.row + rows
  );
}

/** Whether an Item of `type` with its top-left at `at` stays on the grid. */
export function onGrid(type: ItemType, at: Cell): boolean {
  const { columns, rows } = itemTuning[type].size;
  return (
    Number.isInteger(at.column) &&
    Number.isInteger(at.row) &&
    at.column >= 0 &&
    at.row >= 0 &&
    at.column + columns <= inventoryTuning.columns &&
    at.row + rows <= inventoryTuning.rows
  );
}

/** Whether two placed Items share a cell. */
function overlap(
  a: { type: ItemType; cell: Cell },
  b: { type: ItemType; cell: Cell },
): boolean {
  const sizeA = itemTuning[a.type].size;
  const sizeB = itemTuning[b.type].size;
  return (
    a.cell.column < b.cell.column + sizeB.columns &&
    b.cell.column < a.cell.column + sizeA.columns &&
    a.cell.row < b.cell.row + sizeB.rows &&
    b.cell.row < a.cell.row + sizeA.rows
  );
}

/** The ones of `placed` an Item of `type` with its top-left at `at` overlaps. */
export function inTheWay<T extends { type: ItemType; cell: Cell }>(
  placed: readonly T[],
  type: ItemType,
  at: Cell,
): T[] {
  return placed.filter((other) => overlap(other, { type, cell: at }));
}

/**
 * Whether an Item of `type` with its top-left at `at` stays on the grid
 * without overlapping any of `placed`.
 */
export function fitsAt(
  placed: readonly { type: ItemType; cell: Cell }[],
  type: ItemType,
  at: Cell,
): boolean {
  return onGrid(type, at) && inTheWay(placed, type, at).length === 0;
}

/**
 * Where an Item of `type` would go among `placed` Items: the first spot it
 * fits, scanning column by column from the top-left, or null when none.
 */
export function firstFreeCell(
  placed: readonly { type: ItemType; cell: Cell }[],
  type: ItemType,
): Cell | null {
  for (let column = 0; column < inventoryTuning.columns; column++) {
    for (let row = 0; row < inventoryTuning.rows; row++) {
      const cell = { column, row };
      if (fitsAt(placed, type, cell)) return cell;
    }
  }
  return null;
}

/**
 * Whether gear could be the Hero's: known Item types, every Inventory Item
 * on the grid with none overlapping, and every Equipped Item in a slot of
 * its kind.
 */
export function isValidGear(gear: Gear): boolean {
  const known = (type: unknown): type is ItemType =>
    ITEM_TYPES.includes(type as ItemType);
  const { inventory, equipment } = gear;
  const placedFine = inventory.every(
    (placed, i) =>
      known(placed.type) &&
      onGrid(placed.type, placed.cell) &&
      inventory.slice(0, i).every((other) => !overlap(other, placed)),
  );
  const equippedFine = Object.entries(equipment).every(
    ([slot, type]) =>
      Object.hasOwn(SLOT_KINDS, slot) &&
      known(type) &&
      itemTuning[type].kind === SLOT_KINDS[slot as EquipmentSlot],
  );
  return placedFine && equippedFine;
}
