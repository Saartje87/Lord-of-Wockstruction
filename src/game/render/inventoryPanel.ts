import { affixBonus, itemTitle, type RolledAffix } from "../sim/affixes";
import { beltOf, beltRows, isBeltCell } from "../sim/belt";
import {
  type Cell,
  cursorItemOf,
  EQUIPMENT_SLOTS,
  type EquipmentSlot,
  equipmentOf,
  type Item,
  type ItemSpot,
  inventoryItemAt,
  isCell,
  isSlot,
  type SmithBonus,
} from "../sim/inventory";
import { inside, middleOf, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import type { Order, World } from "../sim/world";
import type { Element } from "../tuning/damage";
import {
  affixOf,
  type Bonus,
  beltTuning,
  type ItemType,
  inventoryTuning,
  isPotion,
  itemOf,
  type PotionEffectTuning,
  type PotionResource,
} from "../tuning/items";
import { skillTuning } from "../tuning/skills";
import { atUiScale, type Viewport } from "../viewport";
import { type CloseButton, closeButtonRect, closeHitAt } from "./closeButton";
import { compactPanelRect } from "./compactLayout";
import { skillBarLayout } from "./skillBar";

/**
 * The Inventory panel at the top right (CSS px at native scale, drawn at
 * the UI Scale): `right` and `top` from the
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
const EQUIPMENT_ROWS = 7;

/** How many cells wide the Equipment slots' area is. */
const EQUIPMENT_COLUMNS = 9;

/**
 * Where each Equipment slot sits in its area and how big it is, in cells
 * from the area's top-left, as a Diablo 2-style figure: the Helm top
 * centre with the Amulet to its right, the Weapon and Off-hand tall either
 * side of the Armour, Ring, Belt and Ring in a row under the Armour, and the
 * Gloves and Boots at the bottom corners. No two touch, so every point
 * belongs to at most one.
 */
const SLOT_CELLS: Record<EquipmentSlot, Rect> = {
  helm: { x: 3.5, y: 0.25, w: 2, h: 2 },
  amulet: { x: 5.75, y: 0.25, w: 1, h: 1 },
  weapon: { x: 0.25, y: 1.5, w: 2, h: 3 },
  armour: { x: 3.5, y: 2.5, w: 2, h: 3 },
  offHand: { x: 6.75, y: 1.5, w: 2, h: 3 },
  ring1: { x: 2.5, y: 5.75, w: 1, h: 1 },
  belt: { x: 3.75, y: 5.75, w: 1.5, h: 1 },
  ring2: { x: 5.5, y: 5.75, w: 1, h: 1 },
  gloves: { x: 0.25, y: 4.75, w: 2, h: 2 },
  boots: { x: 6.75, y: 4.75, w: 2, h: 2 },
};

/**
 * Where the Inventory panel, its × close button, its Equipment slots, its
 * Belt Columns and its grid are drawn.
 */
export type InventoryPanelLayout = {
  panel: Rect;
  closeButton: Rect;
  slots: Record<EquipmentSlot, Rect>;
  /**
   * Each Belt Column's cells, from the left, each from the bottom row up:
   * `belt[column][row]`.
   */
  belt: Rect[][];
  grid: Rect;
  /** One grid cell's side (CSS px). */
  cell: number;
};

/**
 * Where the Inventory panel and its slots, Belt Columns and grid go on a
 * `screen` this big, with `beltRows` rows of Belt Columns: they sit
 * centred between the Equipment slots and the grid, `gridGap` from each,
 * and the panel grows to fit their rows.
 */
export function inventoryPanelLayout(
  screen: Viewport,
  beltRows: number,
): InventoryPanelLayout {
  if (screen.compact) return compactInventoryLayout(screen, beltRows);
  const { right, top, padding, titleHeight, gridGap, hintHeight } = atUiScale(
    INVENTORY_PANEL,
    screen.uiScale,
  );
  const { columns, rows } = inventoryTuning;
  const fits = (screen.width / 2 - right - 2 * padding) / columns;
  // The panel stops above the HUD along the bottom, where the Panel buttons are.
  const bottom = skillBarLayout(screen).slots.right.y;
  const fitsDown =
    (bottom - top - 2 * padding - titleHeight - 2 * gridGap - hintHeight) /
    (EQUIPMENT_ROWS + beltRows + rows);
  const cell = cellSize(
    screen,
    INVENTORY_PANEL.maxCell * screen.uiScale,
    fits,
    fitsDown,
  );
  const width = columns * cell + 2 * padding;
  const x = screen.width - right - width;
  const inner = x + padding;
  const slotsTop = top + padding + titleHeight;
  const beltTop = slotsTop + EQUIPMENT_ROWS * cell + gridGap;
  const beltLeft = inner + ((columns - beltTuning.columns) / 2) * cell;
  const belt = Array.from({ length: beltTuning.columns }, (_, column) =>
    Array.from({ length: beltRows }, (_, row) => ({
      x: beltLeft + column * cell,
      y: beltTop + (beltRows - 1 - row) * cell,
      w: cell,
      h: cell,
    })),
  );
  const grid = {
    x: inner,
    y: beltTop + beltRows * cell + gridGap,
    w: columns * cell,
    h: rows * cell,
  };
  const slots = slotRects(
    inner + ((columns - EQUIPMENT_COLUMNS) / 2) * cell,
    slotsTop,
    cell,
  );
  const panel = {
    x,
    y: top,
    w: width,
    h: grid.y + grid.h + hintHeight + padding - top,
  };
  return {
    panel,
    closeButton: closeButtonRect(panel, screen.uiScale),
    slots,
    belt,
    grid,
    cell,
  };
}

/**
 * The Inventory panel in the Compact Layout, filling the screen: too short
 * for them all one above the other, the Equipment slots sit on the left and
 * the grid on the right, `gridGap` apart, with the Belt Columns either
 * between them or centred above the grid, whichever gives bigger cells.
 * Cells are as big as fit, up to `maxCell` at native scale.
 */
function compactInventoryLayout(
  screen: Viewport,
  beltRows: number,
): InventoryPanelLayout {
  const { padding, titleHeight, gridGap, hintHeight } = atUiScale(
    INVENTORY_PANEL,
    screen.uiScale,
  );
  const { columns, rows } = inventoryTuning;
  const panel = compactPanelRect(screen);
  const room = {
    w: panel.w - 2 * padding,
    h: panel.h - 2 * padding - titleHeight - hintHeight,
  };
  const largest = INVENTORY_PANEL.maxCell;
  // The Belt Columns between the Equipment slots and the grid.
  const beside = cellSize(
    screen,
    largest,
    (room.w - 2 * gridGap) / (EQUIPMENT_COLUMNS + beltTuning.columns + columns),
    room.h / Math.max(EQUIPMENT_ROWS, beltRows, rows),
  );
  // The Belt Columns above the grid.
  const above = cellSize(
    screen,
    largest,
    (room.w - gridGap) / (EQUIPMENT_COLUMNS + columns),
    room.h / EQUIPMENT_ROWS,
    (room.h - gridGap) / (beltRows + rows),
  );
  const cell = Math.max(beside, above);
  const beltAbove = above > beside;
  const across = beltAbove
    ? (EQUIPMENT_COLUMNS + columns) * cell + gridGap
    : (EQUIPMENT_COLUMNS + beltTuning.columns + columns) * cell + 2 * gridGap;
  const left = panel.x + (panel.w - across) / 2;
  const top = panel.y + padding + titleHeight;
  const gridLeft = left + across - columns * cell;
  const beltLeft = beltAbove
    ? gridLeft + ((columns - beltTuning.columns) / 2) * cell
    : left + EQUIPMENT_COLUMNS * cell + gridGap;
  const belt = Array.from({ length: beltTuning.columns }, (_, column) =>
    Array.from({ length: beltRows }, (_, row) => ({
      x: beltLeft + column * cell,
      y: top + (beltRows - 1 - row) * cell,
      w: cell,
      h: cell,
    })),
  );
  const grid = {
    x: gridLeft,
    y: beltAbove ? top + beltRows * cell + gridGap : top,
    w: columns * cell,
    h: rows * cell,
  };
  return {
    panel,
    closeButton: closeButtonRect(panel, screen.uiScale),
    slots: slotRects(left, top, cell),
    belt,
    grid,
    cell,
  };
}

/**
 * A grid cell's side on `screen`: as big as each of the room's `fits`
 * allows, up to `largest`, and never under `minCell` at the UI Scale. Whole
 * pixels, so the grid's lines stay crisp.
 */
function cellSize(screen: Viewport, largest: number, ...fits: number[]) {
  return Math.floor(
    Math.max(
      INVENTORY_PANEL.minCell * screen.uiScale,
      Math.min(largest, ...fits),
    ),
  );
}

/**
 * Where each Equipment slot goes, its area's top-left at `x`, `y` and its
 * cells `cell` square.
 */
function slotRects(
  x: number,
  y: number,
  cell: number,
): Record<EquipmentSlot, Rect> {
  return Object.fromEntries(
    Object.entries(SLOT_CELLS).map(([slot, at]) => [
      slot,
      {
        x: x + at.x * cell,
        y: y + at.y * cell,
        w: at.w * cell,
        h: at.h * cell,
      },
    ]),
  ) as Record<EquipmentSlot, Rect>;
}

/** A grid of cells: where it is drawn, and one cell's side (CSS px). */
export type GridLayout = Pick<InventoryPanelLayout, "grid" | "cell">;

/** Where an Item of `type` with its top-left at `at` is drawn on the grid. */
export function itemRect(layout: GridLayout, at: Cell, type: ItemType): Rect {
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
 * Where a Held Item of `type` is drawn: centred on `pointer`, at the size
 * of the grid's cells, so it covers the cells it would land on.
 */
export function heldItemRect(
  layout: Pick<GridLayout, "cell">,
  pointer: Vec,
  type: ItemType,
): Rect {
  const { cell } = layout;
  const { columns, rows } = itemOf(type).size;
  return {
    x: pointer.x - (columns * cell) / 2,
    y: pointer.y - (rows * cell) / 2,
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
 * A point on the open Inventory panel's ×, so not for the World: a click
 * there shuts the panel, as I does.
 */
export type InventoryCloseHit = { button: CloseButton };

/**
 * A point off the open Inventory panel while an Item is held, so not for the
 * World either: a click there drops the Item.
 */
export type DropHit = { drop: true };

/**
 * What a point hits of the Inventory panel, or null when it's off the
 * panel or the panel isn't `open`, so it's for the World; but off the panel
 * while `holding` an Item, a drop. Its × is there whether or not an Item is
 * held. A point on the line between two cells is in the right or lower one,
 * and the grid's far edges are in its last cells. The Belt Columns have
 * `beltRows` rows.
 */
export function inventoryHitAt(
  screen: Viewport,
  point: Vec,
  open: boolean,
  holding: boolean,
  beltRows: number,
): InventoryHit | InventoryCloseHit | DropHit | null {
  if (!open) return null;
  const layout = inventoryPanelLayout(screen, beltRows);
  if (!inside(layout.panel, point)) return holding ? { drop: true } : null;
  const closeHit = closeHitAt(layout, point, "inventory");
  if (closeHit) return closeHit;
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
  for (const [beltColumn, cells] of layout.belt.entries()) {
    const row = cells.findIndex((rect) => inside(rect, point));
    if (row !== -1) return { inventory: { beltColumn, row } };
  }
  return { inventory: null };
}

/**
 * The cell where an Item of `type` held at `point` would go down: its
 * top-left when centred on the point, on the nearest cell lines. It may hang
 * off the grid.
 */
export function landingCell(
  layout: GridLayout,
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
 * panel: with nothing held, lifting the Item on the cell, in the slot or in
 * the Belt Column cell;
 * with an Item held, putting it down where it lands on the grid, into the
 * slot or into the Belt Column, or dropping it off the panel. Null when it
 * gives none.
 */
export function inventoryOrder(
  world: World,
  screen: Viewport,
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
  return putDownOrder(world, screen, point, spot, held.item.type);
}

/**
 * The order that puts a held Item of `type` down at `point`, on `spot` of
 * the Inventory panel: where it lands on the grid, or into the slot or Belt
 * Column.
 */
export function putDownOrder(
  world: World,
  screen: Viewport,
  point: Vec,
  spot: ItemSpot,
  type: ItemType,
): Order {
  if (!isCell(spot)) return { type: "PlaceItem", to: spot };
  const layout = inventoryPanelLayout(screen, beltRows(world));
  return { type: "PlaceItem", to: landingCell(layout, point, type) };
}

/**
 * The order a right-click gives, for what it hit of the Inventory panel:
 * equipping the Inventory Item under it or drinking it if it's a Potion, or
 * unequipping the Item in the slot. Null when it gives none, as with an Item
 * held or on a Belt Column cell.
 */
export function inventoryRightClickOrder(
  world: World,
  hit: InventoryHit | DropHit | { vendor: unknown },
): Order | null {
  if ("drop" in hit || "vendor" in hit || !hit.inventory || cursorItemOf(world))
    return null;
  const spot = hit.inventory;
  const item = itemUnder(world, spot);
  if (!item || isBeltCell(spot)) return null;
  if (isSlot(spot)) return { type: "UnequipItem", slot: spot };
  return isPotion(item.type)
    ? { type: "DrinkItem", item: item.id }
    : { type: "EquipItem", item: item.id };
}

/** The Item at a spot on the panel, or null when there's none. */
export function itemUnder(world: World, spot: ItemSpot): Item | null {
  if (isSlot(spot)) return equipmentOf(world)[spot];
  if (isBeltCell(spot)) {
    return beltOf(world)[spot.beltColumn]?.[spot.row] ?? null;
  }
  return inventoryItemAt(world, spot)?.item ?? null;
}

/** Each Bonus as a tooltip names it. */
const BONUS_NAMES: Record<Bonus, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  vitality: "Vitality",
  energy: "Energy",
  life: "Life",
  defense: "Defense",
  attackRating: "Attack Rating",
  weaponDamage: "Damage",
  mana: "Mana",
  enhancedDamage: "Enhanced Damage",
  enhancedDefense: "Enhanced Defense",
  fireResistance: "Fire Resistance",
  coldResistance: "Cold Resistance",
  lightningResistance: "Lightning Resistance",
  allResistances: "All Resistances",
  block: "Block",
  fireDamage: "Fire Damage",
  coldDamage: "Cold Damage",
  lightningDamage: "Lightning Damage",
  attackSpeed: "attack speed",
  walkSpeed: "walk speed",
  skillLevel: "Skill Level",
};

/** The Element a single-Element Resistance Bonus guards against. */
const BONUS_ELEMENT: Partial<Record<Bonus, Element>> = {
  fireResistance: "fire",
  coldResistance: "cold",
  lightningResistance: "lightning",
  fireDamage: "fire",
  coldDamage: "cold",
  lightningDamage: "lightning",
};

/** The Bonuses that add an Element's damage, a line each: "+3 Fire Damage". */
const ELEMENTAL_DAMAGE_BONUSES: readonly Bonus[] = [
  "fireDamage",
  "coldDamage",
  "lightningDamage",
];

/** The Bonuses that are percentages, not flat amounts. */
const PERCENT_BONUSES: readonly Bonus[] = [
  "enhancedDamage",
  "enhancedDefense",
  "fireResistance",
  "coldResistance",
  "lightningResistance",
  "allResistances",
  "block",
  "attackSpeed",
  "walkSpeed",
];

/** A tooltip line giving `amount` of `bonus`. */
function bonusLine(bonus: Bonus, amount: number): string {
  if (ELEMENTAL_DAMAGE_BONUSES.includes(bonus)) {
    return `+${amount} ${BONUS_NAMES[bonus]}`;
  }
  return PERCENT_BONUSES.includes(bonus)
    ? `+${amount}% ${BONUS_NAMES[bonus]}`
    : `+${amount} to ${BONUS_NAMES[bonus]}`;
}

/** Each resource a Potion gives back, as a tooltip names it. */
const RESOURCE_NAMES: Record<PotionResource, string> = {
  life: "Life",
  mana: "Mana",
};

/** The tooltip line saying what drinking a Potion gives back. */
function potionLine(effect: PotionEffectTuning): string {
  if (effect.type === "atOnce") {
    const names = effect.resources.map((resource) => RESOURCE_NAMES[resource]);
    const share = Math.round(effect.share * 100);
    return `Gives back ${share}% of ${names.join(" and ")} at once`;
  }
  const seconds = effect.durationMs / 1000;
  return `Gives back ${effect.amount} ${RESOURCE_NAMES[effect.resource]} over ${seconds} seconds`;
}

/**
 * The lines of an Item's tooltip, all of them the Item's own fixed values,
 * as in Diablo 2: its name, then a Weapon's damage before the Hero's
 * Strength, an Armour's Defense, its type's bonuses, one line for each
 * Affix, the Smith bonus, what a Potion gives back and a Belt's rows. A
 * Magic Item's name carries its Affixes' grade names.
 */
export function itemTooltip(shown: Shown): string[] {
  return tooltipLines(shown).map((line) => line.text);
}

/**
 * The Element each line of `itemTooltip(shown)` is drawn in, or null for a
 * line with none: a single-Element Resistance Affix line takes its
 * Element's colour.
 */
export function itemTooltipElements(shown: Shown): (Element | null)[] {
  return tooltipLines(shown).map((line) => line.element ?? null);
}

/** What a tooltip needs of an Item. */
type Shown = {
  type: ItemType;
  affixes?: readonly RolledAffix[];
  rareName?: string;
  smithBonus?: SmithBonus;
};

/** A tooltip line, and the Element it is drawn in when it has one. */
type TooltipLine = { text: string; element?: Element };

function tooltipLines(shown: Shown): TooltipLine[] {
  const { smithBonus } = shown;
  const item = itemOf(shown.type);
  // A Rare Item shows its Rare name, then its type's name.
  const names = shown.rareName
    ? [shown.rareName, item.name]
    : [itemTitle(shown)];
  const lines: TooltipLine[] = names.map((text) => ({ text }));
  if (item.damage) {
    // Each hit rounds its own damage, so the range shows rounded too.
    const [min, max] = item.damage;
    lines.push({ text: `Damage: ${Math.round(min)}–${Math.round(max)}` });
  }
  if (item.defense !== undefined)
    lines.push({ text: `Defense: ${item.defense}` });
  if (item.block !== undefined) lines.push({ text: `Block: ${item.block}%` });
  for (const [bonus, amount] of Object.entries(item.bonuses)) {
    lines.push({ text: `+${amount} to ${BONUS_NAMES[bonus as Bonus]}` });
  }
  for (const affix of shown.affixes ?? []) {
    const { bonus, amount } = affixBonus(affix);
    const skill = affixOf(affix.kind).skill;
    lines.push({
      text: skill
        ? `+${amount} to ${skillTuning[skill].name}`
        : bonusLine(bonus, amount),
      element: BONUS_ELEMENT[bonus],
    });
  }
  if (smithBonus) {
    lines.push({
      text: `Smith: ${bonusLine(smithBonus.bonus, smithBonus.amount)}`,
    });
  }
  if (item.potion) lines.push({ text: potionLine(item.potion) });
  if (item.beltRows !== undefined)
    lines.push({ text: `Rows: ${item.beltRows}` });
  return lines;
}

/**
 * A spot on the Inventory panel the Focus can rest on: a grid cell, an
 * Equipment slot, a Belt Column cell or the ×, where it is drawn, and the
 * point and hit a click on it gives.
 */
export type InventoryFocusSpot = {
  rect: Rect;
  at: Vec;
  hit: InventoryHit | InventoryCloseHit;
};

/**
 * The Inventory panel's Focus spots: each grid cell, Equipment slot and
 * Belt Column cell, and its ×, each clicked at its middle. With an Item
 * held, a grid cell is clicked where the Item goes down with its top-left
 * on that cell, or as near as keeps it on the grid, so it is drawn and
 * lands there.
 */
export function inventoryFocusSpots(
  world: World,
  screen: Viewport,
): InventoryFocusSpot[] {
  const layout = inventoryPanelLayout(screen, beltRows(world));
  const { grid, cell } = layout;
  const held = cursorItemOf(world)?.item.type ?? null;
  const { columns, rows } = inventoryTuning;
  const spots: InventoryFocusSpot[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const rect = {
        x: grid.x + column * cell,
        y: grid.y + row * cell,
        w: cell,
        h: cell,
      };
      const size = held && itemOf(held).size;
      const at =
        held && size
          ? middleOf(
              itemRect(
                layout,
                {
                  column: Math.min(column, columns - size.columns),
                  row: Math.min(row, rows - size.rows),
                },
                held,
              ),
            )
          : middleOf(rect);
      spots.push({ rect, at, hit: { inventory: { column, row } } });
    }
  }
  for (const slot of EQUIPMENT_SLOTS) {
    const rect = layout.slots[slot];
    spots.push({ rect, at: middleOf(rect), hit: { inventory: slot } });
  }
  layout.belt.forEach((cells, beltColumn) => {
    cells.forEach((rect, row) => {
      const hit = { inventory: { beltColumn, row } };
      spots.push({ rect, at: middleOf(rect), hit });
    });
  });
  const { closeButton } = layout;
  const hit = { button: { type: "close", panel: "inventory" } } as const;
  spots.push({ rect: closeButton, at: middleOf(closeButton), hit });
  return spots;
}
