import type { BeltStripHit } from "./render/beltStrip";
import type { PanelHit } from "./render/heroPanel";
import {
  type DropHit,
  type InventoryCloseHit,
  type InventoryHit,
  inventoryOrder,
  itemUnder,
  putDownOrder,
} from "./render/inventoryPanel";
import type { SkillBarHit } from "./render/skillBar";
import type { SkillTreeHit } from "./render/skillTreePanel";
import type { ItemSpot } from "./sim/inventory";
import type { Vec } from "./sim/vec";
import type { Order, World } from "./sim/world";
import type { ItemType } from "./tuning/items";
import type { Skill } from "./tuning/skills";

/**
 * What the cursor holds besides the Held Item, which lives in the World. UI
 * state: the Save never keeps it.
 */
export type Cursor = {
  /** The Held Skill, until it lands on the Skill Bar or is let go of. */
  heldSkill: Skill | null;
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
  | SkillBarHit
  | BeltStripHit
  | InventoryHit
  | InventoryCloseHit
  | DropHit;

/** Where a press or release was, and what it hit there. */
export type CursorPoint<At = Vec> = { at: At; hit: CursorHit | null };

/**
 * Where the left button went up, or off the canvas (null), what it hit
 * there, and whether the pointer was `dragged` past the drag threshold since
 * it went down, or this ends a click.
 */
export type CursorRelease = CursorPoint<Vec | null> & { dragged: boolean };

/** What the cursor works with: the World and the screen as last drawn. */
export type CursorScene = {
  world: World;
  screen: { width: number; height: number };
};

/**
 * What a press or release did with the cursor: the orders to send, the
 * cursor after it, and whether it was `taken`, so it isn't for the World.
 */
export type CursorOutcome = {
  cursor: Cursor;
  orders: Order[];
  taken: boolean;
};

export function createCursor(): Cursor {
  return { heldSkill: null, liftedFrom: null };
}

/**
 * What a press of the left button does with Held Items and Held Skills.
 *
 * - On the Inventory panel, with nothing held, it lifts the Item there as
 *   the Held Item, for its release to put down if it's dragged; with one
 *   held, it puts it down there.
 * - Off the panels with an Item held, it drops it, and orders nothing else.
 * - On a learned Skill in the Skill Tree, it picks it up as the Held Skill.
 *
 * Any press on the panels and HUD is taken, its buttons left to the menus;
 * a press over the World with nothing held is not.
 */
export function pressCursor(
  cursor: Cursor,
  press: CursorPoint,
  { world, screen }: CursorScene,
): CursorOutcome {
  const { hit, at } = press;
  cursor = { ...cursor, liftedFrom: null };
  if (hit === null) return { cursor, orders: [], taken: false };
  if (!("button" in hit)) {
    const order = inventoryOrder(world, screen, at, hit);
    const lifted = order?.type === "LiftItem" && itemUnder(world, order.from);
    if (lifted) cursor.liftedFrom = { spot: order.from, type: lifted.type };
    return { cursor, orders: order ? [order] : [], taken: true };
  }
  if (hit.button?.type === "dragSkill") {
    const heldSkill = hit.button.skill;
    return { cursor: { ...cursor, heldSkill }, orders: [], taken: true };
  }
  return { cursor, orders: [], taken: true };
}

/**
 * What a release of the left button, at a point or off the canvas (null),
 * does with Held Items and Held Skills.
 *
 * - A Held Skill lands in the Skill Bar slot there; anywhere else it is let
 *   go of, changing nothing.
 * - A Held Item lifted by the press, dragged and let go over a different
 *   spot, is put down, swapped or dropped there, just as a second click
 *   there would; otherwise it stays held, for a second click to put down.
 */
export function releaseCursor(
  cursor: Cursor,
  release: CursorRelease,
  scene: CursorScene,
): CursorOutcome {
  const { heldSkill, liftedFrom } = cursor;
  if (heldSkill === null && liftedFrom !== null) {
    const orders = release.dragged
      ? putDownOnRelease(release, liftedFrom, scene)
      : [];
    return { cursor: { ...cursor, liftedFrom: null }, orders, taken: true };
  }
  if (heldSkill === null) return { cursor, orders: [], taken: false };
  const button = release.hit && "button" in release.hit && release.hit.button;
  const orders: Order[] =
    button && button.type === "skillBarSlot"
      ? [{ type: "PutSkillOnBar", skill: heldSkill, slot: button.slot }]
      : [];
  return { cursor: { ...cursor, heldSkill: null }, orders, taken: true };
}

/**
 * What letting go of a dragged Held Item does: what a second click there
 * would, but nothing over the spot it was lifted from or off the canvas.
 * Over the World it drops, even before the World has the Item held, when
 * the panel didn't yet hit-test the point as a drop.
 */
function putDownOnRelease(
  { at, hit }: CursorRelease,
  lifted: NonNullable<Cursor["liftedFrom"]>,
  { world, screen }: CursorScene,
): Order[] {
  if (at === null) return [];
  if (hit === null || "drop" in hit) return [{ type: "DropItem" }];
  if (!("inventory" in hit) || hit.inventory === null) return [];
  const spot = hit.inventory;
  if (sameSpot(spot, lifted.spot)) return [];
  return [putDownOrder(world, screen, at, spot, lifted.type)];
}

function sameSpot(a: ItemSpot, b: ItemSpot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A pause or the Hero's Death lets go of the Held Skill. */
export function settleCursor(
  cursor: Cursor,
  { paused, heroDead }: { paused: boolean; heroDead: boolean },
): Cursor {
  return paused || heroDead ? { ...cursor, heldSkill: null } : cursor;
}
