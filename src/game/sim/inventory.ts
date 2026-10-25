import {
  ITEM_TYPES,
  type ItemKind,
  type ItemType,
  inventoryTuning,
  itemOf,
  itemTuning,
} from "../tuning/items";
import { overlaps, type Rect } from "./rect";
import type { Hero, Order, SimEvent, World } from "./world";

/** Unique within the World and never reused. */
export type ItemId = number;

/** One Item: its type says everything about it but which one it is. */
export type Item = { id: ItemId; type: ItemType };

/** An Inventory cell, counted from the top-left. */
export type Cell = { column: number; row: number };

/** An Item in the Inventory, with `cell` its top-left cell. */
export type PlacedItem = { item: Item; cell: Cell };

/**
 * An Item in the Inventory by its type alone, with `cell` its top-left
 * cell: all the placing rules and the Save need to know of it.
 */
export type PlacedType = { type: ItemType; cell: Cell };

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
 * The Hero's Belongings by Item type, as the Save keeps them: Item ids are
 * handed out afresh when a World is made from them.
 */
export type Belongings = {
  inventory: PlacedType[];
  equipment: Partial<Record<EquipmentSlot, ItemType>>;
};

/** A New Hero's Belongings: a Short Sword Equipped and an empty Inventory. */
export const FRESH_BELONGINGS: Belongings = {
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

/** The box a placed Item covers, in cells. */
function cellsOf({ type, cell }: PlacedType): Rect {
  const { columns, rows } = itemTuning[type].size;
  return { x: cell.column, y: cell.row, w: columns, h: rows };
}

/** The ones of `placed` an Item of `type` with its top-left at `at` overlaps. */
export function inTheWay<T extends PlacedType>(
  placed: readonly T[],
  type: ItemType,
  at: Cell,
): T[] {
  const box = cellsOf({ type, cell: at });
  return placed.filter((other) => overlaps(cellsOf(other), box));
}

/**
 * Whether an Item of `type` with its top-left at `at` stays on the grid
 * without overlapping any of `placed`.
 */
export function fitsAt(
  placed: readonly PlacedType[],
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
  placed: readonly PlacedType[],
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
 * Where an Item of `type` goes among `placed` Items: `back` at the cell it
 * was at if it fits there, else the first free spot, or null for none.
 */
function backOrFirstFree(
  placed: readonly PlacedType[],
  type: ItemType,
  back: Cell,
): Cell | null {
  return fitsAt(placed, type, back) ? back : firstFreeCell(placed, type);
}

/**
 * Whether Belongings could be the Hero's: known Item types, every Inventory
 * Item on the grid with none overlapping, and every Equipped Item in a slot
 * of its kind.
 */
export function isValidBelongings(belongings: Belongings): boolean {
  const known = (type: unknown): type is ItemType =>
    ITEM_TYPES.includes(type as ItemType);
  const { inventory, equipment } = belongings;
  const placedFine = inventory.every(
    (placed, i) =>
      known(placed.type) &&
      onGrid(placed.type, placed.cell) &&
      inTheWay(inventory.slice(0, i), placed.type, placed.cell).length === 0,
  );
  const equippedFine = Object.entries(equipment).every(
    ([slot, type]) =>
      Object.hasOwn(SLOT_KINDS, slot) &&
      known(type) &&
      itemTuning[type].kind === SLOT_KINDS[slot as EquipmentSlot],
  );
  return placedFine && equippedFine;
}

/** Every Equipment slot, empty. */
export function emptyEquipment(): Equipment {
  return Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [slot, null]),
  ) as Equipment;
}

/**
 * Hands the World's Hero `belongings`, giving each Item the World's next
 * id.
 */
export function giveBelongings(world: World, belongings: Belongings) {
  const { hero } = world;
  for (const { type, cell } of belongings.inventory) {
    hero.inventory.push({
      item: { id: world.nextItemId++, type },
      cell: { ...cell },
    });
  }
  for (const slot of EQUIPMENT_SLOTS) {
    const type = belongings.equipment[slot];
    if (type) hero.equipment[slot] = { id: world.nextItemId++, type };
  }
}

/**
 * The Hero's Belongings by Item type, as the Save keeps them: a held Item
 * is back at the cell or slot it was lifted from.
 */
export function belongingsOf(world: World): Belongings {
  const { equipment, cursor } = world.hero;
  const worn: Belongings["equipment"] = {};
  for (const slot of EQUIPMENT_SLOTS) {
    const item = equipment[slot];
    if (item) worn[slot] = item.type;
  }
  if (cursor && isSlot(cursor.from)) worn[cursor.from] = cursor.item.type;
  return {
    inventory: taken(world.hero).map(({ type, cell }) => ({
      type,
      cell: { ...cell },
    })),
    equipment: worn,
  };
}

/** The Items in the Inventory, each with its top-left cell. */
export function inventoryOf(world: World): PlacedItem[] {
  return world.hero.inventory.map(copyPlaced);
}

/** The Inventory Item covering `cell`, or null when it's free. */
export function inventoryItemAt(world: World, cell: Cell): PlacedItem | null {
  const placed = world.hero.inventory.find(({ item, cell: at }) =>
    covers(item.type, at, cell),
  );
  return placed ? copyPlaced(placed) : null;
}

/** A copy of a placed Item, so a query's answer can't change the World. */
function copyPlaced({ item, cell }: PlacedItem): PlacedItem {
  return { item: { ...item }, cell: { ...cell } };
}

/** The Item held on the cursor and the cell it was lifted from, or null. */
export function cursorItemOf(world: World): CursorItem | null {
  const { cursor } = world.hero;
  return cursor && { item: { ...cursor.item }, from: copySpot(cursor.from) };
}

/** A copy of a spot, so a query's answer can't change the World. */
function copySpot(spot: ItemSpot): ItemSpot {
  return isSlot(spot) ? spot : { ...spot };
}

/** What's in each Equipment slot. */
export function equipmentOf(world: World): Equipment {
  return Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => {
      const item = world.hero.equipment[slot];
      return [slot, item && { ...item }];
    }),
  ) as Equipment;
}

/**
 * Applies an order moving Items, returning whether it was one. These happen
 * at once, whatever the Hero is doing.
 */
export function moveItem(
  world: World,
  order: Order,
  events: SimEvent[],
): boolean {
  switch (order.type) {
    case "LiftItem":
      liftItem(world, order.from, events);
      return true;
    case "PlaceItem":
      placeItem(world, order.to, events);
      return true;
    case "DropItem":
      dropItem(world, events);
      return true;
    case "EquipItem":
      equipItem(world, order.item, events);
      return true;
    case "UnequipItem":
      unequipItem(world, order.slot, events);
      return true;
    case "ReturnCursorItem":
      returnCursorItem(world, events);
      return true;
    default:
      return false;
  }
}

/**
 * Lifts the Inventory Item covering cell `from`, or the Item Equipped in
 * slot `from`, onto an empty cursor.
 */
function liftItem(world: World, from: ItemSpot, events: SimEvent[]) {
  const { hero } = world;
  if (hero.cursor) return;
  if (isSlot(from)) {
    const item = hero.equipment[from];
    if (!item) return;
    hero.equipment[from] = null;
    hero.cursor = { item, from };
    events.push({ type: "ItemUnequipped", item: { ...item }, slot: from });
    events.push({ type: "InventoryChanged" });
    return;
  }
  const placed = hero.inventory.find(({ item, cell: at }) =>
    covers(item.type, at, from),
  );
  if (!placed) return;
  hero.inventory = hero.inventory.filter((other) => other !== placed);
  hero.cursor = { item: placed.item, from: placed.cell };
  events.push({ type: "InventoryChanged" });
}

/**
 * What putting the cursor Item down would do: the Item it would swap onto
 * the cursor, if any, and the spot that Item would go back to.
 */
type Placing = { out: Item; home: ItemSpot } | { out: null };

/**
 * How the cursor Item would go down at `to`, or null when it can't: on the
 * grid with its top-left at a cell, or into a slot of its kind. A
 * swapped-out Item goes back to where the cursor Item was lifted from if it
 * fits there, or else to the first free spot; with neither, the swap is
 * refused, so a held Item always has somewhere to go back to.
 */
function planPlacing(world: World, to: ItemSpot): Placing | null {
  const { cursor, inventory, equipment } = world.hero;
  if (!cursor) return null;
  if (isSlot(to)) {
    if (itemOf(cursor.item.type).kind !== SLOT_KINDS[to]) return null;
    const out = equipment[to];
    if (!out) return { out: null };
    const home = homeFor(out.type, cursor.from, typesOf(inventory));
    return home && { out, home };
  }
  if (!onGrid(cursor.item.type, to)) return null;
  const blocking = inTheWay(withTypes(inventory), cursor.item.type, to);
  if (blocking.length === 0) return { out: null };
  if (blocking.length > 1) return null;
  const [{ placed: out }] = blocking;
  const after = [
    ...typesOf(inventory.filter((other) => other !== out)),
    { type: cursor.item.type, cell: to },
  ];
  const home = homeFor(out.item.type, cursor.from, after);
  return home && { out: out.item, home };
}

/**
 * Where an Item of `type` swapped onto the cursor goes back to: `from` if it
 * fits there among `placed`, else the first free spot, or null for none.
 */
function homeFor(
  type: ItemType,
  from: ItemSpot,
  placed: readonly PlacedType[],
): ItemSpot | null {
  if (!isSlot(from)) return backOrFirstFree(placed, type, from);
  return itemOf(type).kind === SLOT_KINDS[from]
    ? from
    : firstFreeCell(placed, type);
}

/** Placed Items by type and top-left cell. */
function typesOf(inventory: readonly PlacedItem[]): PlacedType[] {
  return inventory.map(({ item, cell }) => ({ type: item.type, cell }));
}

/**
 * Placed Items by type and top-left cell, each keeping the placed Item it
 * stands for, to tell which ones are in the way.
 */
function withTypes(inventory: readonly PlacedItem[]) {
  return inventory.map((placed) => ({
    type: placed.item.type,
    cell: placed.cell,
    placed,
  }));
}

/**
 * What putting the cursor Item down at `to` (a cell for its top-left, or a
 * slot) would do: `"fits"` into free cells or an empty slot, `"swap"` with
 * the one Item in the way, or null when it's refused or the cursor is empty.
 */
export function placement(world: World, to: ItemSpot): "fits" | "swap" | null {
  const placing = planPlacing(world, to);
  if (!placing) return null;
  return placing.out ? "swap" : "fits";
}

/** Puts the cursor Item down at `to`, unless that's refused. */
function placeItem(world: World, to: ItemSpot, events: SimEvent[]) {
  const { hero } = world;
  const placing = planPlacing(world, to);
  if (!hero.cursor || !placing) return;
  const { item } = hero.cursor;
  const { out } = placing;
  if (isSlot(to)) {
    hero.equipment[to] = item;
    if (out)
      events.push({ type: "ItemUnequipped", item: { ...out }, slot: to });
    events.push({ type: "ItemEquipped", item: { ...item }, slot: to });
  } else {
    hero.inventory = [
      ...hero.inventory.filter((other) => other.item !== out),
      { item, cell: { ...to } },
    ];
  }
  hero.cursor = out && { item: out, from: placing.home };
  events.push({ type: "InventoryChanged" });
}

/** Lays the cursor Item on the ground at the Hero's feet. */
function dropItem(world: World, events: SimEvent[]) {
  const { hero } = world;
  if (!hero.cursor) return;
  const { item } = hero.cursor;
  const pos = { ...hero.pos };
  hero.cursor = null;
  world.groundItems.push({ item, pos });
  events.push({ type: "ItemDropped", item: { ...item }, pos: { ...pos } });
  events.push({ type: "InventoryChanged" });
}

/**
 * Equips an Inventory Item into the slot of its kind. What was there goes
 * where the Item was if it fits there, or else to the first free spot; with
 * neither, it's refused.
 */
function equipItem(world: World, id: ItemId, events: SimEvent[]) {
  const { hero } = world;
  if (hero.cursor) return;
  const placed = hero.inventory.find(({ item }) => item.id === id);
  if (!placed) return;
  const slot = slotFor(hero.equipment, placed.item.type);
  const rest = hero.inventory.filter((other) => other !== placed);
  const out = hero.equipment[slot];
  if (out) {
    const home = backOrFirstFree(typesOf(rest), out.type, placed.cell);
    if (!home) return;
    rest.push({ item: out, cell: { ...home } });
    events.push({ type: "ItemUnequipped", item: { ...out }, slot });
  }
  hero.inventory = rest;
  hero.equipment[slot] = placed.item;
  events.push({ type: "ItemEquipped", item: { ...placed.item }, slot });
  events.push({ type: "InventoryChanged" });
}

/**
 * Moves the Item Equipped in `slot` to the first free spot, which a held
 * Item's cell isn't, or says there's no room.
 */
function unequipItem(world: World, slot: EquipmentSlot, events: SimEvent[]) {
  const { hero } = world;
  const item = hero.equipment[slot];
  if (!item) return;
  const cell = firstFreeCell(taken(hero), item.type);
  if (!cell) {
    events.push({ type: "NoRoom" });
    return;
  }
  hero.equipment[slot] = null;
  hero.inventory.push({ item, cell });
  events.push({ type: "ItemUnequipped", item: { ...item }, slot });
  events.push({ type: "InventoryChanged" });
}

/**
 * The slot an Item of `type` is Equipped into: the first empty one of its
 * kind, or else the first of its kind, so a Ring goes into the empty Ring
 * slot or else the left one.
 */
function slotFor(equipment: Equipment, type: ItemType): EquipmentSlot {
  const { kind } = itemOf(type);
  const fitting = EQUIPMENT_SLOTS.filter((slot) => SLOT_KINDS[slot] === kind);
  return fitting.find((slot) => !equipment[slot]) ?? fitting[0];
}

/** Puts the cursor Item back at the cell or slot it was lifted from, kept free. */
export function returnCursorItem(world: World, events: SimEvent[]) {
  const { hero } = world;
  if (!hero.cursor) return;
  const { item, from } = hero.cursor;
  if (isSlot(from)) {
    hero.equipment[from] = item;
    events.push({ type: "ItemEquipped", item: { ...item }, slot: from });
  } else {
    hero.inventory.push({ item, cell: from });
  }
  hero.cursor = null;
  events.push({ type: "InventoryChanged" });
}

/**
 * The cells taken in the Inventory, by type and top-left cell: its Items',
 * and the cursor Item's at the cell it goes back to.
 */
export function taken(hero: Hero): PlacedType[] {
  const { inventory, cursor } = hero;
  const placed = typesOf(inventory);
  if (cursor && !isSlot(cursor.from)) {
    placed.push({ type: cursor.item.type, cell: cursor.from });
  }
  return placed;
}
