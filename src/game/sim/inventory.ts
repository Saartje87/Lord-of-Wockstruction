import {
  BONUSES,
  type Bonus,
  ITEM_TYPES,
  type ItemKind,
  type ItemType,
  inventoryTuning,
  isPotion,
  itemOf,
  itemTuning,
  type Rarity,
} from "../tuning/items";
import { smithPoolOf } from "../tuning/smith";
import { isValidRoll, type RolledAffix } from "./affixes";
import {
  type BeltCell,
  type BeltTypes,
  beltRows,
  beltTypesOf,
  isBeltCell,
  isValidBelt,
  moveOverflow,
  newHeroBelt,
  type Overflow,
  overflowFor,
  rowsOf,
} from "./belt";
import { overlaps, type Rect } from "./rect";
import type { Hero, Order, SimEvent, World } from "./world";

/** Unique within the World and never reused. */
export type ItemId = number;

/** What the Smith added to an Item: one bonus, like the ones Items have. */
export type SmithBonus = { bonus: Bonus; amount: number };

/**
 * One Item: its type, its Rarity and rolled Affixes, and the bonus the Smith
 * may have added to it, which is never an Affix.
 */
export type Item = {
  id: ItemId;
  type: ItemType;
  rarity: Rarity;
  affixes: RolledAffix[];
  /** A Rare Item's two-word name. */
  rareName?: string;
  smithBonus?: SmithBonus;
};

/**
 * An Item as the Save keeps it, without its id and place. A Rarity left
 * out is Normal and Affixes left out are none.
 */
export type StoredItem = {
  type: ItemType;
  rarity?: Rarity;
  affixes?: RolledAffix[];
  rareName?: string;
  smithBonus?: SmithBonus;
};

/**
 * An Item as stored: a copy that shares nothing with it, leaving out a
 * Normal Rarity and no Affixes, which a stored Item has by default.
 */
export function storedOf(item: StoredItem): StoredItem {
  const { rarity = "normal", affixes = [], rareName, smithBonus } = item;
  return {
    type: item.type,
    ...(rarity !== "normal" && { rarity }),
    ...(affixes.length > 0 && { affixes: affixes.map((a) => ({ ...a })) }),
    ...(rareName !== undefined && { rareName }),
    ...(smithBonus && { smithBonus: { ...smithBonus } }),
  };
}

/** A stored Item as the Save writes it, with its Rarity and Affixes named. */
export function savedItem(
  item: StoredItem,
): Required<Pick<StoredItem, "rarity" | "affixes">> & StoredItem {
  return {
    ...storedOf(item),
    rarity: item.rarity ?? "normal",
    affixes: (item.affixes ?? []).map((a) => ({ ...a })),
  };
}

/** A stored Item as an Item, with the World's next id. */
export function itemFrom(world: World, stored: StoredItem): Item {
  return {
    id: world.nextItemId++,
    type: stored.type,
    rarity: stored.rarity ?? "normal",
    affixes: (stored.affixes ?? []).map((a) => ({ ...a })),
    ...(stored.rareName !== undefined && { rareName: stored.rareName }),
    ...(stored.smithBonus && { smithBonus: { ...stored.smithBonus } }),
  };
}

/** An Inventory cell, counted from the top-left. */
export type Cell = { column: number; row: number };

/** An Item in the Inventory, with `cell` its top-left cell. */
export type PlacedItem = { item: Item; cell: Cell };

/**
 * An Item in the Inventory by its type alone, with `cell` its top-left
 * cell: all the placing rules and the Save need to know of it.
 */
export type PlacedType = StoredItem & { cell: Cell };

/**
 * Where an Item can be: an Inventory cell (its top-left), an Equipment slot
 * or a Belt Column cell.
 */
export type ItemSpot = Cell | EquipmentSlot | BeltCell;

/**
 * Where a Held Item came from besides the Hero's own spots: the Vendor's
 * grid, `good` its top-left cell there.
 */
export type GoodSpot = { good: Cell };

/** Where a Held Item came from: an `ItemSpot` or a Vendor's good. */
export type CursorSpot = ItemSpot | GoodSpot;

/** Whether a spot is an Equipment slot rather than a cell. */
export function isSlot(spot: CursorSpot): spot is EquipmentSlot {
  return typeof spot === "string";
}

/** Whether a spot is a good on the Vendor's grid. */
export function isGoodSpot(spot: CursorSpot): spot is GoodSpot {
  return typeof spot === "object" && "good" in spot;
}

/** Whether a spot is an Inventory cell, not a slot or a Belt Column cell. */
export function isCell(spot: CursorSpot): spot is Cell {
  return !isSlot(spot) && !isGoodSpot(spot) && !isBeltCell(spot);
}

/**
 * The Item held on the cursor, with `from` the top-left cell or the slot it
 * goes back to if it's never put down, kept free for it all the while it's
 * held. A good lifted from the Vendor is not Belongings: it goes back to the
 * Vendor, and is bought only by being put down.
 */
export type CursorItem = { item: Item; from: CursorSpot };

/**
 * The Hero's Equipment slots in the order of the Inventory panel's figure
 * (top row, middle, bottom, left to right), which is the order Focus
 * visits them in.
 */
export const EQUIPMENT_SLOTS = [
  "helm",
  "amulet",
  "weapon",
  "armour",
  "offHand",
  "ring1",
  "belt",
  "ring2",
  "gloves",
  "boots",
] as const;

/** One of the Hero's Equipment slots. */
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

/** What's in each Equipment slot, null when empty. */
export type Equipment = Record<EquipmentSlot, Item | null>;

/** The set of Item kinds each slot takes. */
export const SLOT_KINDS: Record<EquipmentSlot, readonly ItemKind[]> = {
  weapon: ["weapon", "wand"],
  offHand: ["shield", "wand"],
  helm: ["helm"],
  armour: ["armour"],
  gloves: ["gloves"],
  boots: ["boots"],
  belt: ["belt"],
  amulet: ["amulet"],
  ring1: ["ring"],
  ring2: ["ring"],
};

/** Whether an Item of `type` fits Equipment slot `slot`. */
export function fitsSlot(slot: EquipmentSlot, type: ItemType): boolean {
  return SLOT_KINDS[slot].includes(itemOf(type).kind);
}

/**
 * The Hero's Belongings by Item type, as the Save keeps them: Item ids are
 * handed out afresh when a World is made from them.
 */
export type Belongings = {
  inventory: PlacedType[];
  equipment: Partial<Record<EquipmentSlot, StoredItem>>;
  /** The Potions in each Belt Column, from the left and each from the bottom up. */
  belt: BeltTypes;
};

/**
 * A New Hero's Belongings: a Short Sword Equipped, an empty Inventory and
 * the starting Potions in the Belt Columns.
 */
export const FRESH_BELONGINGS: Belongings = {
  inventory: [],
  equipment: { weapon: { type: "shortSword" } },
  belt: newHeroBelt(),
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

/** A grid's size in cells. */
export type GridSize = { columns: number; rows: number };

/**
 * Whether an Item of `type` with its top-left at `at` stays on a grid, the
 * Inventory's unless `grid` says another.
 */
export function onGrid(
  type: ItemType,
  at: Cell,
  grid: GridSize = inventoryTuning,
): boolean {
  const { columns, rows } = itemTuning[type].size;
  return (
    Number.isInteger(at.column) &&
    Number.isInteger(at.row) &&
    at.column >= 0 &&
    at.row >= 0 &&
    at.column + columns <= grid.columns &&
    at.row + rows <= grid.rows
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
 * without overlapping any of `placed`, on the Inventory's grid unless
 * `grid` says another.
 */
export function fitsAt(
  placed: readonly PlacedType[],
  type: ItemType,
  at: Cell,
  grid: GridSize = inventoryTuning,
): boolean {
  return onGrid(type, at, grid) && inTheWay(placed, type, at).length === 0;
}

/**
 * Where an Item of `type` would go among `placed` Items: the first spot it
 * fits, scanning column by column from the top-left, or null when none.
 * On the Inventory's grid unless `grid` says another.
 */
export function firstFreeCell(
  placed: readonly PlacedType[],
  type: ItemType,
  grid: GridSize = inventoryTuning,
): Cell | null {
  for (let column = 0; column < grid.columns; column++) {
    for (let row = 0; row < grid.rows; row++) {
      const cell = { column, row };
      if (fitsAt(placed, type, cell, grid)) return cell;
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
 * Item on the grid with none overlapping, every Equipped Item in a slot of
 * its kind, and only Potions in the Belt Columns, as many as they hold.
 */
export function isValidBelongings(belongings: Belongings): boolean {
  const known = (type: unknown): type is ItemType =>
    ITEM_TYPES.includes(type as ItemType);
  const { inventory, equipment, belt } = belongings;
  const itemFine = (stored: StoredItem) =>
    known(stored.type) &&
    isValidRoll(
      stored.type,
      stored.rarity ?? "normal",
      stored.affixes ?? [],
      stored.rareName,
    ) &&
    (stored.smithBonus === undefined ||
      (isSmithable(stored.type) && isValidSmithBonus(stored.smithBonus)));
  const placedFine = inventory.every(
    (placed, i) =>
      itemFine(placed) &&
      onGrid(placed.type, placed.cell) &&
      inTheWay(inventory.slice(0, i), placed.type, placed.cell).length === 0,
  );
  const equippedFine = Object.entries(equipment).every(
    ([slot, stored]) =>
      Object.hasOwn(SLOT_KINDS, slot) &&
      itemFine(stored) &&
      fitsSlot(slot as EquipmentSlot, stored.type),
  );
  if (!placedFine || !equippedFine) return false;
  return isValidBelt(belt, rowsOf(equipment.belt?.type));
}

/** Whether an Item of `type` is one the Smith can work. */
function isSmithable(type: ItemType): boolean {
  return smithPoolOf(itemTuning[type].kind) !== null;
}

/** Whether `bonus` is a known Bonus by a positive whole amount. */
function isValidSmithBonus(bonus: unknown): bonus is SmithBonus {
  if (typeof bonus !== "object" || bonus === null) return false;
  const { bonus: kind, amount } = bonus as Record<string, unknown>;
  return (
    BONUSES.includes(kind as Bonus) &&
    Number.isInteger(amount) &&
    (amount as number) > 0
  );
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
  for (const stored of belongings.inventory) {
    hero.inventory.push({
      item: itemFrom(world, stored),
      cell: { ...stored.cell },
    });
  }
  for (const slot of EQUIPMENT_SLOTS) {
    const stored = belongings.equipment[slot];
    if (stored) hero.equipment[slot] = itemFrom(world, stored);
  }
  belongings.belt.forEach((column, index) => {
    for (const type of column) {
      hero.belt[index].push(itemFrom(world, { type }));
    }
  });
}

/**
 * The Hero's Belongings as the Save keeps them, Rarity, Affixes and all: a
 * held Item is back at the cell or slot it was lifted from.
 */
export function belongingsOf(world: World): Belongings {
  const { equipment, cursor } = world.hero;
  const worn: Belongings["equipment"] = {};
  for (const slot of EQUIPMENT_SLOTS) {
    const item = equipment[slot];
    if (item) worn[slot] = storedOf(item);
  }
  if (cursor && isSlot(cursor.from)) worn[cursor.from] = storedOf(cursor.item);
  return {
    inventory: taken(world.hero).map((placed) => ({
      ...storedOf(placed),
      cell: { ...placed.cell },
    })),
    equipment: worn,
    belt: beltTypesOf(world),
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
function copySpot(spot: CursorSpot): CursorSpot {
  if (isSlot(spot)) return spot;
  if (isGoodSpot(spot)) return { good: { ...spot.good } };
  return { ...spot } as ItemSpot;
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
 * slot `from`, onto an empty cursor. Lifting the Belt takes it off, so it's
 * refused with No room when the Potions in rows that no longer exist can't
 * all move into the Inventory.
 */
function liftItem(world: World, from: ItemSpot, events: SimEvent[]) {
  const { hero } = world;
  if (hero.cursor) return;
  if (isSlot(from)) {
    const item = hero.equipment[from];
    if (!item) return;
    const overflow = overflowFor(hero, from, null, taken(hero));
    if (!overflow) {
      events.push({ type: "NoRoom" });
      return;
    }
    hero.equipment[from] = null;
    hero.cursor = { item, from };
    moveOverflow(hero, overflow, events);
    events.push({ type: "ItemUnequipped", item: { ...item }, slot: from });
    events.push({ type: "InventoryChanged" });
    return;
  }
  if (isBeltCell(from)) {
    const potions = hero.belt[from.beltColumn];
    const item = potions?.[from.row];
    if (!item) return;
    // The ones above drop down a row.
    potions.splice(from.row, 1);
    hero.cursor = { item, from: { ...from } };
    events.push({ type: "BeltChanged" });
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
 * the cursor, if any, and the spot that Item would go back to, and the
 * Potions it would move out of the Belt.
 */
type Placing = ({ out: Item; home: ItemSpot } | { out: null }) & {
  overflow?: Overflow;
};

/**
 * How the cursor Item would go down at `to`, or null when it can't: on the
 * grid with its top-left at a cell, or into a slot of its kind. A
 * swapped-out Item goes back to where the cursor Item was lifted from if it
 * fits there, or else to the first free spot; with neither, the swap is
 * refused, so a held Item always has somewhere to go back to. A Belt with
 * fewer rows put into the Belt slot moves the Potions in rows that no longer
 * exist into the Inventory, or is refused with `"noRoom"` when they can't
 * all fit.
 */
function planPlacing(world: World, to: ItemSpot): Placing | "noRoom" | null {
  const { hero } = world;
  const { cursor, inventory, equipment, belt } = hero;
  if (!cursor) return null;
  if (isBeltCell(to)) {
    // Only Potions, into a column with room: they never swap.
    const potions = belt[to.beltColumn];
    const fits = potions && potions.length < beltRows(world);
    return isPotion(cursor.item.type) && fits ? { out: null } : null;
  }
  if (isSlot(to)) {
    if (!fitsSlot(to, cursor.item.type)) return null;
    const out = equipment[to];
    const home = out && homeFor(out.type, cursor.from, typesOf(inventory));
    if (out && !home) return null;
    const placed = taken(hero);
    if (out && home && isCell(home))
      placed.push({ type: out.type, cell: home });
    const overflow = overflowFor(hero, to, cursor.item.type, placed);
    if (!overflow) return "noRoom";
    return out && home ? { out, home, overflow } : { out: null, overflow };
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
  from: CursorSpot,
  placed: readonly PlacedType[],
): ItemSpot | null {
  if (isGoodSpot(from)) return firstFreeCell(placed, type);
  if (isBeltCell(from)) {
    // The cursor Item's row is kept for it, so another Potion fits there.
    return isPotion(type) ? from : firstFreeCell(placed, type);
  }
  if (!isSlot(from)) return backOrFirstFree(placed, type, from);
  return fitsSlot(from, type) ? from : firstFreeCell(placed, type);
}

/** Placed Items by type and top-left cell. */
function typesOf(inventory: readonly PlacedItem[]): PlacedType[] {
  return inventory.map(({ item, cell }) => ({
    ...storedOf(item),
    cell,
  }));
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
  if (!placing || placing === "noRoom") return null;
  return placing.out ? "swap" : "fits";
}

/** Puts the cursor Item down at `to`, unless that's refused. */
function placeItem(world: World, to: ItemSpot, events: SimEvent[]) {
  const { hero } = world;
  const placing = planPlacing(world, to);
  if (placing === "noRoom") events.push({ type: "NoRoom" });
  if (!hero.cursor || !placing || placing === "noRoom") return;
  const { item } = hero.cursor;
  const { out } = placing;
  if (isBeltCell(to)) {
    hero.belt[to.beltColumn].push(item);
  } else if (isSlot(to)) {
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
  const { from } = hero.cursor;
  hero.cursor = out && { item: out, from: placing.home };
  if (placing.overflow) moveOverflow(hero, placing.overflow, events);
  // Out of the Belt for good, or into it.
  if (isBeltCell(to) || (isBeltCell(from) && !hero.cursor)) {
    events.push({ type: "BeltChanged" });
  }
  events.push({ type: "InventoryChanged" });
}

/** Lays the cursor Item on the ground at the Hero's feet. */
function dropItem(world: World, events: SimEvent[]) {
  const { hero } = world;
  if (!hero.cursor) return;
  const { item } = hero.cursor;
  const pos = { ...hero.pos };
  if (isBeltCell(hero.cursor.from)) events.push({ type: "BeltChanged" });
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
  // A Potion has no slot to go into.
  if (!slot) return;
  const rest = hero.inventory.filter((other) => other !== placed);
  const out = hero.equipment[slot];
  if (out) {
    const home = backOrFirstFree(typesOf(rest), out.type, placed.cell);
    if (!home) return;
    rest.push({ item: out, cell: { ...home } });
  }
  const overflow = overflowFor(hero, slot, placed.item.type, typesOf(rest));
  if (!overflow) {
    events.push({ type: "NoRoom" });
    return;
  }
  if (out) events.push({ type: "ItemUnequipped", item: { ...out }, slot });
  hero.inventory = rest;
  hero.equipment[slot] = placed.item;
  moveOverflow(hero, overflow, events);
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
  const placed = taken(hero);
  const cell = firstFreeCell(placed, item.type);
  const overflow =
    cell &&
    overflowFor(hero, slot, null, [...placed, { type: item.type, cell }]);
  if (!cell || !overflow) {
    events.push({ type: "NoRoom" });
    return;
  }
  hero.equipment[slot] = null;
  hero.inventory.push({ item, cell });
  moveOverflow(hero, overflow, events);
  events.push({ type: "ItemUnequipped", item: { ...item }, slot });
  events.push({ type: "InventoryChanged" });
}

/**
 * The slot an Item of `type` is Equipped into: the first empty one of its
 * kind, or else the first of its kind, so a Ring goes into the empty Ring
 * slot or else the left one; null for a kind no slot takes.
 */
function slotFor(equipment: Equipment, type: ItemType): EquipmentSlot | null {
  const { kind } = itemOf(type);
  const fitting = EQUIPMENT_SLOTS.filter((slot) =>
    SLOT_KINDS[slot].includes(kind),
  );
  return fitting.find((slot) => !equipment[slot]) ?? fitting[0] ?? null;
}

/** Puts the cursor Item back at the cell or slot it was lifted from, kept free. */
export function returnCursorItem(world: World, events: SimEvent[]) {
  const { hero } = world;
  if (!hero.cursor) return;
  const { item, from } = hero.cursor;
  if (isGoodSpot(from)) {
    // A Potion stayed in the Vendor's grid when it was lifted.
    if (!isPotion(item.type)) {
      world.vendor.goods.push({ item, cell: { ...from.good } });
    }
    hero.cursor = null;
    return;
  }
  if (isBeltCell(from)) {
    hero.belt[from.beltColumn].splice(from.row, 0, item);
    events.push({ type: "BeltChanged" });
  } else if (isSlot(from)) {
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
  if (cursor && isCell(cursor.from)) {
    placed.push({ ...storedOf(cursor.item), cell: cursor.from });
  }
  return placed;
}
