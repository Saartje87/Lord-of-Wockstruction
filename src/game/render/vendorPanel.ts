import {
  type Cell,
  cursorItemOf,
  type Item,
  inventoryItemAt,
  isGoodSpot,
} from "../sim/inventory";
import { inside, middleOf, type Rect } from "../sim/rect";
import { itemValue } from "../sim/value";
import type { Vec } from "../sim/vec";
import { goodAt } from "../sim/vendor";
import type { Order, World } from "../sim/world";
import { type ItemType, inventoryTuning, itemOf } from "../tuning/items";
import { vendorTuning } from "../tuning/vendor";
import { atUiScale, type Viewport } from "../viewport";
import { type CloseButton, closeButtonRect, closeHitAt } from "./closeButton";
import { compactPanelRect } from "./compactLayout";
import {
  type DropHit,
  itemRect,
  itemTooltip,
  landingCell,
} from "./inventoryPanel";

/**
 * The Vendor panel at the top right, where the Inventory panel stands (CSS px
 * at native scale, drawn at the UI Scale): `right` and `top` from the
 * screen's corner, `titleHeight` for its title, the Vendor's grid and the
 * Inventory grid `gap` apart under it, then `hintHeight` for its hint. Cells
 * are `maxCell` square, smaller where the screen can't fit both grids.
 */
export const VENDOR_PANEL = {
  right: 16,
  top: 16,
  padding: 18,
  titleHeight: 40,
  gap: 18,
  hintHeight: 28,
  maxCell: 36,
  minCell: 16,
};

/** Where the Vendor panel, its × and its two grids are drawn. */
export type VendorPanelLayout = {
  panel: Rect;
  closeButton: Rect;
  /** The Vendor's grid, on the left. */
  goods: Rect;
  /** The Hero's Inventory grid, on the right. */
  inventory: Rect;
  /** One grid cell's side (CSS px). */
  cell: number;
};

/**
 * Where the Vendor panel goes on `screen`: at the top right, or in the
 * Compact Layout filling the screen. Both grids share one cell size, as
 * big as fits up to `maxCell`, in whole pixels.
 */
export function vendorPanelLayout(screen: Viewport): VendorPanelLayout {
  const { right, top, padding, titleHeight, gap, hintHeight } = atUiScale(
    VENDOR_PANEL,
    screen.uiScale,
  );
  const goodsColumns = vendorTuning.grid.columns;
  const columns = goodsColumns + inventoryTuning.columns;
  const rows = Math.max(vendorTuning.grid.rows, inventoryTuning.rows);
  const panelAt = screen.compact ? compactPanelRect(screen) : null;
  const room = panelAt ? panelAt.w : screen.width - 2 * right;
  const fitsAcross = (room - 2 * padding - gap) / columns;
  const fitsDown = panelAt
    ? (panelAt.h - 2 * padding - titleHeight - hintHeight) / rows
    : Number.POSITIVE_INFINITY;
  const cell = Math.floor(
    Math.max(
      VENDOR_PANEL.minCell * screen.uiScale,
      Math.min(VENDOR_PANEL.maxCell * screen.uiScale, fitsAcross, fitsDown),
    ),
  );
  const across = columns * cell + gap;
  const width = across + 2 * padding;
  const height = titleHeight + rows * cell + hintHeight + 2 * padding;
  const panel = panelAt ?? {
    x: screen.width - right - width,
    y: top,
    w: width,
    h: height,
  };
  const left = panel.x + (panel.w - across) / 2;
  const gridsTop = panel.y + padding + titleHeight;
  return {
    panel,
    closeButton: closeButtonRect(panel, screen.uiScale),
    goods: {
      x: left,
      y: gridsTop,
      w: goodsColumns * cell,
      h: vendorTuning.grid.rows * cell,
    },
    inventory: {
      x: left + goodsColumns * cell + gap,
      y: gridsTop,
      w: inventoryTuning.columns * cell,
      h: inventoryTuning.rows * cell,
    },
    cell,
  };
}

/** The Vendor's grid as a grid layout: where it is drawn and its cell size. */
export function goodsGrid(layout: VendorPanelLayout) {
  return { grid: layout.goods, cell: layout.cell };
}

/** The Hero's Inventory grid as a grid layout. */
export function inventoryGrid(layout: VendorPanelLayout) {
  return { grid: layout.inventory, cell: layout.cell };
}

/**
 * A point on the open Vendor panel, so not for the World: on a cell of the
 * Vendor's grid (`good`), of the Hero's Inventory grid (`inventory`), or
 * between them (`null`).
 */
export type VendorHit = {
  vendor: { good: Cell } | { inventory: Cell } | null;
};

/** A point on the open Vendor panel's ×, which shuts it as I does. */
export type VendorCloseHit = { button: CloseButton };

/**
 * What a point hits of the Vendor panel, or null when it's off the panel or
 * the panel isn't `open`, so it's for the World; but off the panel while
 * `holding` an Item, a drop. A point on the line between two cells is in
 * the right or lower one.
 */
export function vendorHitAt(
  screen: Viewport,
  point: Vec,
  open: boolean,
  holding: boolean,
): VendorHit | VendorCloseHit | DropHit | null {
  if (!open) return null;
  const layout = vendorPanelLayout(screen);
  if (!inside(layout.panel, point)) return holding ? { drop: true } : null;
  const closeHit = closeHitAt(layout, point, "vendor");
  if (closeHit) return closeHit;
  const { cell } = layout;
  const cellAt = (grid: Rect, columns: number, rows: number): Cell => ({
    column: Math.min(columns - 1, Math.floor((point.x - grid.x) / cell)),
    row: Math.min(rows - 1, Math.floor((point.y - grid.y) / cell)),
  });
  if (inside(layout.goods, point)) {
    const { columns, rows } = vendorTuning.grid;
    return { vendor: { good: cellAt(layout.goods, columns, rows) } };
  }
  if (inside(layout.inventory, point)) {
    const { columns, rows } = inventoryTuning;
    return { vendor: { inventory: cellAt(layout.inventory, columns, rows) } };
  }
  return { vendor: null };
}

/**
 * The order a click at `point` gives, for what it hit of the Vendor panel:
 * with nothing held, lifting the good (buying it, once put down) or the
 * Inventory Item on the cell; with an Item held, putting it down where it
 * lands on the Inventory grid, buying a held good. A held good clicked
 * anywhere else on the panel is given back. Null when it gives none.
 */
export function vendorOrder(
  world: World,
  screen: Viewport,
  point: Vec,
  hit: VendorHit,
): Order | null {
  const held = cursorItemOf(world);
  const spot = hit.vendor;
  if (!held) {
    if (spot && "good" in spot) {
      return goodAt(world, spot.good)
        ? { type: "LiftGood", from: spot.good }
        : null;
    }
    if (spot && "inventory" in spot) {
      return inventoryItemAt(world, spot.inventory)
        ? { type: "LiftItem", from: spot.inventory }
        : null;
    }
    return null;
  }
  if (spot && "inventory" in spot) {
    const layout = inventoryGrid(vendorPanelLayout(screen));
    return {
      type: "PlaceItem",
      to: landingCell(layout, point, held.item.type),
    };
  }
  return isGoodSpot(held.from) ? { type: "DropItem" } : null;
}

/**
 * The order that puts a held Item of `type` down at `point` on the Vendor
 * panel's Inventory grid, where it lands.
 */
export function vendorPutDownOrder(
  screen: Viewport,
  point: Vec,
  type: ItemType,
): Order {
  const layout = inventoryGrid(vendorPanelLayout(screen));
  return { type: "PlaceItem", to: landingCell(layout, point, type) };
}

/** The lines of a good's tooltip: the Item's own, then its Value. */
export function goodTooltip(
  item: Item,
  gold: number,
): { lines: string[]; affordable: boolean } {
  const value = itemValue(item);
  return {
    lines: [...itemTooltip(item), `Value: ${value} Gold`],
    affordable: gold >= value,
  };
}

/** A spot on the Vendor panel the Focus can rest on. */
export type VendorFocusSpot = {
  rect: Rect;
  at: Vec;
  hit: VendorHit | VendorCloseHit;
};

/**
 * The Vendor panel's Focus spots: each cell of the Vendor's grid and of the
 * Inventory grid, each clicked at its middle, then the ×. With an Item held,
 * an Inventory cell is clicked where the Item goes down with its top-left on
 * that cell, or as near as keeps it on the grid.
 */
export function vendorFocusSpots(
  world: World,
  screen: Viewport,
): VendorFocusSpot[] {
  const layout = vendorPanelLayout(screen);
  const { cell } = layout;
  const spots: VendorFocusSpot[] = [];
  const held = cursorItemOf(world)?.item.type ?? null;
  const goods = vendorTuning.grid;
  for (let row = 0; row < goods.rows; row++) {
    for (let column = 0; column < goods.columns; column++) {
      const rect = {
        x: layout.goods.x + column * cell,
        y: layout.goods.y + row * cell,
        w: cell,
        h: cell,
      };
      spots.push({
        rect,
        at: middleOf(rect),
        hit: { vendor: { good: { column, row } } },
      });
    }
  }
  const { columns, rows } = inventoryTuning;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const rect = {
        x: layout.inventory.x + column * cell,
        y: layout.inventory.y + row * cell,
        w: cell,
        h: cell,
      };
      const size = held && itemOf(held).size;
      const at =
        held && size
          ? middleOf(
              itemRect(
                inventoryGrid(layout),
                {
                  column: Math.min(column, columns - size.columns),
                  row: Math.min(row, rows - size.rows),
                },
                held,
              ),
            )
          : middleOf(rect);
      spots.push({ rect, at, hit: { vendor: { inventory: { column, row } } } });
    }
  }
  const { closeButton } = layout;
  const hit = { button: { type: "close", panel: "vendor" } } as const;
  spots.push({ rect: closeButton, at: middleOf(closeButton), hit });
  return spots;
}
