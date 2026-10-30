import { ITEM_TYPES, type ItemType, isPotion, itemOf } from "../tuning/items";
import { vendorTuning } from "../tuning/vendor";
import { TOWN } from "./area";
import { beltRows, isBeltCell } from "./belt";
import {
  type Cell,
  fitsAt,
  type Item,
  type ItemSpot,
  isGoodSpot,
  isSlot,
  itemFrom,
  type PlacedType,
  returnCursorItem,
  storedOf,
} from "./inventory";
import { createRng, type Rng, randomInt } from "./random";
import { overlaps } from "./rect";
import { itemValue } from "./value";
import type { Order, SimEvent, World } from "./world";

/** One of the Vendor's goods, with `cell` its top-left cell on their grid. */
export type Good = { item: Item; cell: Cell };

/**
 * The Vendor's stock: the goods on their grid, never kept by the Save, and
 * the random numbers that stock them, apart from the World's so shopping
 * never changes a fight.
 */
export type Vendor = { goods: Good[]; rng: Rng };

/** A Vendor with nothing yet, stocking from `seed`. */
export function newVendor(seed: number): Vendor {
  return { goods: [], rng: createRng(seed ^ 0x5ee0d0) };
}

/** The Vendor's goods, each with its top-left cell. */
export function goodsOf(world: World): Good[] {
  return world.vendor.goods.map(({ item, cell }) => ({
    item: { ...item },
    cell: { ...cell },
  }));
}

/** The good covering `cell` of the Vendor's grid, if any. */
export function goodAt(world: World, cell: Cell): Good | null {
  const good = covering(world.vendor.goods, cell);
  return good && { item: { ...good.item }, cell: { ...good.cell } };
}

/** The one of `goods` covering `cell`, if any. */
function covering(goods: readonly Good[], cell: Cell): Good | null {
  return (
    goods.find(({ item, cell: at }) => {
      const { columns, rows } = itemOf(item.type).size;
      return (
        cell.column >= at.column &&
        cell.column < at.column + columns &&
        cell.row >= at.row &&
        cell.row < at.row + rows
      );
    }) ?? null
  );
}

/** The cells a placed type covers, as a box. */
function box({ type, cell }: PlacedType) {
  const { columns, rows } = itemOf(type).size;
  return { x: cell.column, y: cell.row, w: columns, h: rows };
}

/** Whether an Item of `type` fits at `at` on the Vendor's grid among `placed`. */
function fitsOnGrid(
  placed: readonly PlacedType[],
  type: ItemType,
  at: Cell,
): boolean {
  const { columns, rows } = itemOf(type).size;
  const within =
    at.column >= 0 &&
    at.row >= 0 &&
    at.column + columns <= vendorTuning.grid.columns &&
    at.row + rows <= vendorTuning.grid.rows;
  const mine = { x: at.column, y: at.row, w: columns, h: rows };
  return within && !placed.some((other) => overlaps(box(other), mine));
}

/** The first spot an Item of `type` fits on the Vendor's grid, column by column. */
function firstFree(placed: readonly PlacedType[], type: ItemType): Cell | null {
  for (let column = 0; column < vendorTuning.grid.columns; column++) {
    for (let row = 0; row < vendorTuning.grid.rows; row++) {
      if (fitsOnGrid(placed, type, { column, row })) return { column, row };
    }
  }
  return null;
}

/**
 * Stocks the Vendor afresh, as the Hero arrives in Town: one of every
 * Potion, then a few Normal Weapons, Armour and Belts, each placed at the
 * first spot it fits. A good that fits nowhere is left out.
 */
export function restockVendor(world: World, events: SimEvent[]) {
  const { vendor } = world;
  vendor.goods = [];
  const types: ItemType[] = ITEM_TYPES.filter(isPotion);
  for (const [kind, range] of Object.entries(vendorTuning.stock)) {
    const of = ITEM_TYPES.filter((type) => itemOf(type).kind === kind);
    const count = randomInt(vendor.rng, range);
    for (let i = 0; i < count; i++) {
      types.push(of[randomInt(vendor.rng, [0, of.length - 1])]);
    }
  }
  const placed: PlacedType[] = [];
  for (const type of types) {
    const cell = firstFree(placed, type);
    if (!cell) continue;
    placed.push({ type, cell });
    vendor.goods.push({ item: itemFrom(world, { type }), cell });
  }
  events.push({ type: "VendorRestocked" });
}

/**
 * Applies an order lifting or buying a Vendor's good, returning whether it
 * was one: lifting a good, or putting down, dropping or returning one held.
 * These happen at once, whatever the Hero is doing.
 */
export function moveGood(
  world: World,
  order: Order,
  events: SimEvent[],
): boolean {
  const { hero } = world;
  if (order.type === "LiftGood") {
    liftGood(world, order.from, events);
    return true;
  }
  if (order.type === "SellItem") {
    sellItem(world, events);
    return true;
  }
  if (!hero.cursor || !isGoodSpot(hero.cursor.from)) return false;
  if (order.type === "PlaceItem") {
    buyGood(world, order.to, events);
    return true;
  }
  if (order.type === "DropItem") {
    // Letting a good go anywhere else gives it back, never to the ground.
    returnCursorItem(world, events);
    return true;
  }
  return false;
}

/** What the Vendor pays for an Item: a quarter of its Value, rounded down. */
export function sellPrice(item: Parameters<typeof itemValue>[0]): number {
  return Math.floor(itemValue(item) / 4);
}

/**
 * Sells the Hero's Held Item: it is gone, never among the goods, and its
 * price is added to Gold. Refused in Death, outside Town, with nothing held
 * and for a held good.
 */
function sellItem(world: World, events: SimEvent[]) {
  const { hero } = world;
  const { cursor } = hero;
  if (!cursor || isGoodSpot(cursor.from)) return;
  if (world.death || world.areaName !== TOWN) return;
  const value = sellPrice(cursor.item);
  hero.progress.gold += value;
  hero.cursor = null;
  events.push({ type: "ItemSold", item: { ...cursor.item }, value });
  events.push({ type: "InventoryChanged" });
}

/**
 * Lifts the good covering `from` onto an empty cursor, refused with
 * `CantAfford` when the Hero's Gold is under its Value. A Potion stays on the
 * grid, the Hero lifting a fresh one, so the Vendor never runs out.
 */
function liftGood(world: World, from: Cell, events: SimEvent[]) {
  const { hero, vendor } = world;
  if (hero.cursor || world.areaName !== TOWN) return;
  const good = covering(vendor.goods, from);
  if (!good) return;
  const value = itemValue(good.item);
  if (hero.progress.gold < value) {
    events.push({ type: "CantAfford", item: { ...good.item }, value });
    return;
  }
  if (isPotion(good.item.type)) {
    hero.cursor = {
      item: itemFrom(world, storedOf(good.item)),
      from: { good: { ...good.cell } },
    };
    return;
  }
  vendor.goods = vendor.goods.filter((other) => other !== good);
  hero.cursor = { item: good.item, from: { good: { ...good.cell } } };
}

/**
 * Whether the held good could be bought by putting it down at `to`: an
 * Inventory cell for its top-left, or a Belt Column cell for a Potion. It
 * must fit in free room, swapping nothing, and the Hero must afford it.
 */
export function buyable(world: World, to: ItemSpot): boolean {
  const { hero } = world;
  const { cursor } = hero;
  if (!cursor || !isGoodSpot(cursor.from) || isSlot(to)) return false;
  const { item } = cursor;
  if (hero.progress.gold < itemValue(item)) return false;
  if (isBeltCell(to)) {
    const potions = hero.belt[to.beltColumn];
    return isPotion(item.type) && !!potions && potions.length < beltRows(world);
  }
  const placed: PlacedType[] = hero.inventory.map((other) => ({
    ...storedOf(other.item),
    cell: other.cell,
  }));
  return fitsAt(placed, item.type, to);
}

/**
 * Buys the held good by putting it down at `to`, if `buyable`: Gold goes
 * down by its Value in the same step and it joins the Belongings. Otherwise
 * it stays held.
 */
function buyGood(world: World, to: ItemSpot, events: SimEvent[]) {
  const { hero } = world;
  const { cursor } = hero;
  if (!cursor || !buyable(world, to)) return;
  const { item } = cursor;
  const value = itemValue(item);
  if (isBeltCell(to)) {
    hero.belt[to.beltColumn].push(item);
    events.push({ type: "BeltChanged" });
  } else {
    hero.inventory.push({ item, cell: { ...(to as Cell) } });
  }
  hero.progress.gold -= value;
  hero.cursor = null;
  events.push({ type: "ItemBought", item: { ...item }, value });
  events.push({ type: "InventoryChanged" });
}
