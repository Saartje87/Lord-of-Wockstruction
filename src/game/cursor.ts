import type { InputWay } from "./input/activeInput";
import type { BeltStripHit } from "./render/beltStrip";
import type { DialogueHit } from "./render/dialoguePanel";
import type { PanelHit } from "./render/heroPanel";
import {
  type DropHit,
  type InventoryCloseHit,
  type InventoryHit,
  inventoryOrder,
  itemUnder,
  putDownOrder,
} from "./render/inventoryPanel";
import type { MiniMapHit } from "./render/miniMap";
import type { PanelButtonHit } from "./render/panelButtons";
import type { QuestPanelHit } from "./render/questPanel";
import type { SkillBarHit } from "./render/skillBar";
import type { SkillTreeHit } from "./render/skillTreePanel";
import type { WaypointListHit } from "./render/waypointList";
import { isBeltCell } from "./sim/belt";
import { cursorItemOf, type ItemSpot, isSlot } from "./sim/inventory";
import { type SkillBarSlot, skillInSlot } from "./sim/skillBar";
import type { Vec } from "./sim/vec";
import type { Order, World } from "./sim/world";
import type { ItemType } from "./tuning/items";
import type { Skill } from "./tuning/skills";
import type { Viewport } from "./viewport";

/**
 * What the cursor holds besides the Held Item, which lives in the World. UI
 * state: the Save never keeps it.
 */
export type Cursor = {
  /** The Held Skill, until it lands on the Skill Bar or is let go of. */
  heldSkill: Skill | null;
  /**
   * The Skill Bar slot the Held Skill was picked up from, drawn dimmed while
   * it is held; null for one picked up from the Skill Tree.
   */
  heldSkillSlot: SkillBarSlot | null;
  /**
   * The spot the press still held down lifted the Held Item from, and its
   * type, so letting go elsewhere after a drag puts it down there. Null when
   * that press lifted nothing.
   */
  liftedFrom: { spot: ItemSpot; type: ItemType } | null;
};

/**
 * What a point hits of the panels and the HUD, as the renderer's `panelAt`
 * hands it back. Null is a point over the World.
 */
export type CursorHit =
  | PanelHit
  | SkillTreeHit
  | QuestPanelHit
  | WaypointListHit
  | DialogueHit
  | SkillBarHit
  | BeltStripHit
  | PanelButtonHit
  | MiniMapHit
  | InventoryHit
  | InventoryCloseHit
  | DropHit;

/** Where a press or release was, and what it hit there. */
export type CursorPoint<At = Vec> = { at: At; hit: CursorHit | null };

/** Where the left button went up, or off the canvas (null), and what it hit there. */
export type CursorRelease = CursorPoint<Vec | null>;

/**
 * What the cursor works with: the World and the viewport as last drawn, so a
 * Held Item lands where the panels were laid out, and the Active Input
 * `way`, mouse and keyboard when not given.
 */
export type CursorScene = { world: World; screen: Viewport; way?: InputWay };

/**
 * What a press or release did with the cursor: the orders to send, the
 * cursor after it, and whether it was `taken`, so it isn't for the World.
 */
export type CursorOutcome = {
  cursor: Cursor;
  orders: Order[];
  taken: boolean;
};

/** A cursor holding no Skill, as the game starts. */
export function createCursor(): Cursor {
  return { heldSkill: null, heldSkillSlot: null, liftedFrom: null };
}

/**
 * What a press of the left button does with Held Items and Held Skills.
 *
 * - On the Inventory panel or a Belt strip square, with nothing held, it
 *   lifts the Item there as the Held Item (a Belt Column's bottom Potion on
 *   the strip), for its release to put down if it's dragged off that spot;
 *   with one held, it puts it down there (on the strip, at the column's
 *   lowest free row).
 * - On touch, a tap on a Belt strip square only ever drinks from its Belt
 *   Column; Potions go in and out of the Belt on the Inventory panel.
 * - Off the panels with an Item held, it drops it, and orders nothing else,
 *   whether or not the Inventory panel is open.
 * - On a learned Skill in the Skill Tree, or a filled Skill Bar slot, with
 *   no Item held, it picks it up as the Held Skill. The Skill Bar stays as
 *   it is until the Skill lands.
 * - With a Held Skill, on a Skill Bar slot it puts it there; on a Panel
 *   button it keeps it, as that panel's key does; anywhere else, the World
 *   too, it lets go of it, changing nothing.
 *
 * Any press on the panels and HUD is taken, its buttons left to the menus
 * unless it put down or let go of a Held Skill; a press over the World with
 * nothing held is not.
 */
export function pressCursor(
  cursor: Cursor,
  press: CursorPoint,
  { world, screen, way }: CursorScene,
): CursorOutcome {
  const { at } = press;
  const hit = asItemSpot(press.hit);
  cursor = { ...cursor, liftedFrom: null };
  const { heldSkill } = cursor;
  if (heldSkill !== null && onPanelButton(hit)) {
    return { cursor, orders: [], taken: true };
  }
  if (heldSkill !== null) return landHeldSkill(cursor, heldSkill, hit);
  if (way === "touch" && press.hit && "beltColumn" in press.hit) {
    const column = press.hit.beltColumn;
    return { cursor, orders: [{ type: "DrinkFromBelt", column }], taken: true };
  }
  if (hit === null) {
    // Over the World with an Item held, even with the Inventory panel shut
    // after a lift from the Belt strip, the press drops it, and only that.
    if (cursorItemOf(world) === null) {
      return { cursor, orders: [], taken: false };
    }
    return { cursor, orders: [{ type: "DropItem" }], taken: true };
  }
  if (!("button" in hit)) {
    const order = inventoryOrder(world, screen, at, hit);
    const lifted = order?.type === "LiftItem" && itemUnder(world, order.from);
    if (lifted) cursor.liftedFrom = { spot: order.from, type: lifted.type };
    return { cursor, orders: order ? [order] : [], taken: true };
  }
  // The cursor holds a Held Item or a Held Skill, never both.
  if (cursorItemOf(world) === null) {
    const { button } = hit;
    if (button?.type === "pickUpSkill") {
      const heldSkill = button.skill;
      return {
        cursor: { ...cursor, heldSkill, heldSkillSlot: null },
        orders: [],
        taken: true,
      };
    }
    const onBar =
      button?.type === "skillBarSlot" ? skillInSlot(world, button.slot) : null;
    if (button?.type === "skillBarSlot" && onBar) {
      const held = { heldSkill: onBar, heldSkillSlot: button.slot };
      return { cursor: { ...cursor, ...held }, orders: [], taken: true };
    }
  }
  return { cursor, orders: [], taken: true };
}

/**
 * What a release of the left button, at a point or off the canvas (null),
 * does with Held Items and Held Skills.
 *
 * - A Held Skill lands in the Skill Bar slot there; over the Skill Tree spot
 *   or Skill Bar slot it was picked up from, or a Panel button, it stays
 *   held, for a second click; anywhere else it is let go of, changing
 *   nothing.
 * - A Held Item lifted by the press and let go over a different spot (a
 *   Belt strip square or the World among them) was dragged, however short
 *   the move: it is put down, swapped or dropped there, just as a second
 *   click there would. Let go over the spot it was lifted from, it stays
 *   held, for a second click to put down.
 */
export function releaseCursor(
  cursor: Cursor,
  release: CursorRelease,
  scene: CursorScene,
): CursorOutcome {
  const { heldSkill, liftedFrom } = cursor;
  if (heldSkill === null && liftedFrom !== null) {
    const orders = putDownOnRelease(release, liftedFrom, scene);
    return { cursor: { ...cursor, liftedFrom: null }, orders, taken: true };
  }
  if (heldSkill === null) return { cursor, orders: [], taken: false };
  const button = buttonOf(release.hit);
  // Released where it was picked up: a click, so it stays for the next one.
  const pickedUpHere =
    cursor.heldSkillSlot === null
      ? button?.type === "pickUpSkill" && button.skill === heldSkill
      : button?.type === "skillBarSlot" && button.slot === cursor.heldSkillSlot;
  if (pickedUpHere || onPanelButton(release.hit)) {
    return { cursor, orders: [], taken: true };
  }
  return landHeldSkill(cursor, heldSkill, release.hit);
}

/**
 * A press and release at the same point, as a click there, or the Focus
 * pressed there, gives: lifting, putting down, dropping, or picking up and
 * landing a Held Skill, never dragging.
 */
export function clickCursor(
  cursor: Cursor,
  point: CursorPoint,
  scene: CursorScene,
): CursorOutcome {
  const pressed = pressCursor(cursor, point, scene);
  const released = releaseCursor(pressed.cursor, point, scene);
  return {
    cursor: released.cursor,
    orders: [...pressed.orders, ...released.orders],
    taken: pressed.taken || released.taken,
  };
}

/**
 * Puts the Held Skill into the Skill Bar slot `hit`, by the Skill Bar's
 * swap rule, or anywhere else lets go of it, changing nothing. Either way
 * the cursor holds no Skill after, and the press or release is not for the
 * World.
 */
function landHeldSkill(
  cursor: Cursor,
  heldSkill: Skill,
  hit: CursorHit | null,
): CursorOutcome {
  const button = buttonOf(hit);
  const orders: Order[] =
    button?.type === "skillBarSlot"
      ? [{ type: "PutSkillOnBar", skill: heldSkill, slot: button.slot }]
      : [];
  return { cursor: letGoOfSkill(cursor), orders, taken: true };
}

/**
 * What letting go of a lifted Held Item does: what a second click there
 * would, but nothing over the spot it was lifted from or off the canvas.
 * Over the World it drops, even before the World has the Item held, when
 * the panel didn't yet hit-test the point as a drop.
 */
function putDownOnRelease(
  release: CursorRelease,
  lifted: NonNullable<Cursor["liftedFrom"]>,
  { world, screen }: CursorScene,
): Order[] {
  const { at } = release;
  const hit = asItemSpot(release.hit);
  if (at === null) return [];
  if (hit === null || "drop" in hit) return [{ type: "DropItem" }];
  if (!("inventory" in hit) || hit.inventory === null) return [];
  const spot = hit.inventory;
  if (sameSpot(spot, lifted.spot)) return [];
  return [putDownOrder(world, screen, at, spot, lifted.type)];
}

/**
 * A point on a Belt strip square as the Belt Column spot it stands for: its
 * bottom row, the Potion lifted from there, and where a Potion put down
 * there goes in at the lowest free row. Any other hit is as it was.
 */
function asItemSpot(hit: CursorHit | null): CursorHit | null {
  if (hit === null || !("beltColumn" in hit)) return hit;
  return { inventory: { beltColumn: hit.beltColumn, row: 0 } };
}

/** Whether two spots are the same slot, cell or Belt Column cell. */
function sameSpot(a: ItemSpot, b: ItemSpot): boolean {
  if (isSlot(a) || isSlot(b)) return a === b;
  if (isBeltCell(a) || isBeltCell(b)) {
    return (
      isBeltCell(a) &&
      isBeltCell(b) &&
      a.beltColumn === b.beltColumn &&
      a.row === b.row
    );
  }
  return a.column === b.column && a.row === b.row;
}

/** The panel or HUD button `hit`, if it is one. */
function buttonOf(hit: CursorHit | null) {
  return hit && "button" in hit ? hit.button : null;
}

/** Whether `hit` is a Panel button, which leaves a Held Skill held. */
function onPanelButton(hit: CursorHit | null): boolean {
  return buttonOf(hit)?.type === "panelButton";
}

/** A pause or the Hero's Death lets go of the Held Skill. */
export function settleCursor(
  cursor: Cursor,
  { paused, heroDead }: { paused: boolean; heroDead: boolean },
): Cursor {
  return paused || heroDead ? letGoOfSkill(cursor) : cursor;
}

/** The cursor with no Held Skill. */
function letGoOfSkill(cursor: Cursor): Cursor {
  return { ...cursor, heldSkill: null, heldSkillSlot: null };
}

/**
 * What a point hits that isn't for the World, as `poll` needs it. Off the
 * panels with an Item held, the point hits a `DropHit`, which only a press
 * of the left button uses: it is still the World for a right-click's cast.
 */
export function forTheWorld(hit: CursorHit | null): CursorHit | null {
  return hit && "drop" in hit ? null : hit;
}
