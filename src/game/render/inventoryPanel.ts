import {
  type Cell,
  cursorItemOf,
  type EquipmentSlot,
  equipmentOf,
  type Item,
  type ItemSpot,
  inventoryItemAt,
  isSlot,
} from "../sim/inventory";
import { inside, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import type { Order, World } from "../sim/world";
import {
  type Bonus,
  type ItemType,
  inventoryTuning,
  itemOf,
} from "../tuning/items";

/**
 * The Inventory panel at the top right (CSS px): `right` and `top` from the
 * screen's corner, `titleHeight` for its title, the Equipment slots under
 * it and the grid `gridGap` under them, then `hintHeight` for its hint.
 * Cells are `maxCell` square, smaller where half the screen can't fit ten.
 */
export const INVENTORY_PANEL = {
  right: 16,
  top: 16,
  padding: 18,
  titleHeight: 40,
  gridGap: 18,
  hintHeight: 28,
  maxCell: 36,
  minCell: 16,
};

/** How many cells tall the Equipment slots' area is, above the grid. */
const EQUIPMENT_ROWS = 5;

/**
 * Where each Equipment slot sits in its area and how big it is, in cells
 * from the area's top-left: as in Diablo 2, the Weapon on the left, the
 * Armour in the middle, the Amulet top right and a Ring either side below
 * the Armour.
 */
const SLOT_CELLS: Record<EquipmentSlot, Rect> = {
  weapon: { x: 0.5, y: 0.5, w: 2, h: 4 },
  armour: { x: 4, y: 0.5, w: 2, h: 3 },
  amulet: { x: 7, y: 0.5, w: 1, h: 1 },
  ring1: { x: 3, y: 4, w: 1, h: 1 },
  ring2: { x: 6, y: 4, w: 1, h: 1 },
};

/** Where the Inventory panel, its Equipment slots and its grid are drawn. */
export type InventoryPanelLayout = {
  panel: Rect;
  slots: Record<EquipmentSlot, Rect>;
  grid: Rect;
  /** One grid cell's side (CSS px). */
  cell: number;
};

/** Where the Inventory panel and its slots and grid go on a `screen` this big. */
export function inventoryPanelLayout(screen: {
  width: number;
  height: number;
}): InventoryPanelLayout {
  const { right, top, padding, titleHeight, gridGap, hintHeight } =
    INVENTORY_PANEL;
  const { columns, rows } = inventoryTuning;
  const fits = Math.floor((screen.width / 2 - right - 2 * padding) / columns);
  const cell = Math.max(
    INVENTORY_PANEL.minCell,
    Math.min(INVENTORY_PANEL.maxCell, fits),
  );
  const width = columns * cell + 2 * padding;
  const x = screen.width - right - width;
  const inner = x + padding;
  const slotsTop = top + padding + titleHeight;
  const grid = {
    x: inner,
    y: slotsTop + EQUIPMENT_ROWS * cell + gridGap,
    w: columns * cell,
    h: rows * cell,
  };
  const slots = Object.fromEntries(
    Object.entries(SLOT_CELLS).map(([slot, at]) => [
      slot,
      {
        x: inner + at.x * cell,
        y: slotsTop + at.y * cell,
        w: at.w * cell,
        h: at.h * cell,
      },
    ]),
  ) as Record<EquipmentSlot, Rect>;
  return {
    panel: {
      x,
      y: top,
      w: width,
      h: grid.y + grid.h + hintHeight + padding - top,
    },
    slots,
    grid,
    cell,
  };
}

/** Where an Item of `type` with its top-left at `at` is drawn on the grid. */
export function itemRect(
  layout: InventoryPanelLayout,
  at: Cell,
  type: ItemType,
): Rect {
  const { grid, cell } = layout;
  const { columns, rows } = itemOf(type).size;
  return {
    x: grid.x + at.column * cell,
    y: grid.y + at.row * cell,
    w: columns * cell,
    h: rows * cell,
  };
}

/**
 * A point on the open Inventory panel, so not for the World: the spot it's
 * on, or null between them.
 */
export type InventoryHit = { inventory: ItemSpot | null };

/**
 * A point off the open Inventory panel while an Item is held, so not for the
 * World either: a click there drops the Item.
 */
export type DropHit = { drop: true };

/**
 * What a point hits of the Inventory panel, or null when it's off the
 * panel or the panel isn't `open`, so it's for the World; but off the panel
 * while `holding` an Item, a drop. A point on the line between two cells is
 * in the right or lower one, and the grid's far edges are in its last cells.
 */
export function inventoryHitAt(
  screen: { width: number; height: number },
  point: Vec,
  open: boolean,
  holding = false,
): InventoryHit | DropHit | null {
  if (!open) return null;
  const layout = inventoryPanelLayout(screen);
  if (!inside(layout.panel, point)) return holding ? { drop: true } : null;
  const { grid, cell } = layout;
  if (inside(grid, point)) {
    const { columns, rows } = inventoryTuning;
    const column = Math.min(columns - 1, Math.floor((point.x - grid.x) / cell));
    const row = Math.min(rows - 1, Math.floor((point.y - grid.y) / cell));
    return { inventory: { column, row } };
  }
  for (const [slot, rect] of Object.entries(layout.slots)) {
    if (inside(rect, point)) {
      return { inventory: slot as EquipmentSlot };
    }
  }
  return { inventory: null };
}

/**
 * The cell where an Item of `type` held at `point` would go down: its
 * top-left when centred on the point, on the nearest cell lines. It may hang
 * off the grid.
 */
export function landingCell(
  layout: InventoryPanelLayout,
  point: Vec,
  type: ItemType,
): Cell {
  const { grid, cell } = layout;
  const { columns, rows } = itemOf(type).size;
  const across = (point.x - grid.x) / cell;
  const down = (point.y - grid.y) / cell;
  return {
    column: Math.floor(across - columns / 2 + 0.5),
    row: Math.floor(down - rows / 2 + 0.5),
  };
}

/**
 * The order a click at `point` gives, for what it hit of the Inventory
 * panel: with nothing held, lifting the Item on the cell or in the slot;
 * with an Item held, putting it down where it lands on the grid or into the
 * slot, or dropping it off the panel. Null when it gives none.
 */
export function inventoryOrder(
  world: World,
  screen: { width: number; height: number },
  point: Vec,
  hit: InventoryHit | DropHit,
): Order | null {
  const held = cursorItemOf(world);
  if ("drop" in hit) return held && { type: "DropItem" };
  const spot = hit.inventory;
  if (!spot) return null;
  if (!held) {
    return itemUnder(world, spot) ? { type: "LiftItem", from: spot } : null;
  }
  if (isSlot(spot)) return { type: "PlaceItem", to: spot };
  const layout = inventoryPanelLayout(screen);
  return { type: "PlaceItem", to: landingCell(layout, point, held.item.type) };
}

/**
 * The order a right-click gives, for what it hit of the Inventory panel:
 * equipping the Inventory Item under it, or unequipping the Item in the
 * slot. Null when it gives none, as with an Item held.
 */
export function inventoryRightClickOrder(
  world: World,
  hit: InventoryHit | DropHit,
): Order | null {
  if ("drop" in hit || !hit.inventory || cursorItemOf(world)) return null;
  const spot = hit.inventory;
  const item = itemUnder(world, spot);
  if (!item) return null;
  return isSlot(spot)
    ? { type: "UnequipItem", slot: spot }
    : { type: "EquipItem", item: item.id };
}

/** The Item at a spot on the panel, or null when there's none. */
export function itemUnder(world: World, spot: ItemSpot): Item | null {
  if (isSlot(spot)) return equipmentOf(world)[spot];
  return inventoryItemAt(world, spot)?.item ?? null;
}

const BONUS_NAMES: Record<Bonus, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  vitality: "Vitality",
  energy: "Energy",
  life: "Life",
  defense: "Defense",
  attackRating: "Attack Rating",
};

/**
 * The lines of an Item's tooltip, all of them the Item's own fixed values,
 * as in Diablo 2: its name, then a Weapon's damage before the Hero's
 * Strength, an Armour's Defense, and its bonuses.
 */
export function itemTooltip(type: ItemType): string[] {
  const item = itemOf(type);
  const lines = [item.name];
  if (item.damage) {
    // Each hit rounds its own damage, so the range shows rounded too.
    const [min, max] = item.damage;
    lines.push(`Damage: ${Math.round(min)}–${Math.round(max)}`);
  }
  if (item.defense !== undefined) lines.push(`Defense: ${item.defense}`);
  for (const [bonus, amount] of Object.entries(item.bonuses)) {
    lines.push(`+${amount} to ${BONUS_NAMES[bonus as Bonus]}`);
  }
  return lines;
}
