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
