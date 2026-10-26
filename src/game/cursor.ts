import type { BeltStripHit } from "./render/beltStrip";
import type { PanelHit } from "./render/heroPanel";
import {
  type DropHit,
  type InventoryCloseHit,
  type InventoryHit,
  inventoryOrder,
} from "./render/inventoryPanel";
import type { SkillBarHit } from "./render/skillBar";
import type { SkillTreeHit } from "./render/skillTreePanel";
import { cursorItemOf } from "./sim/inventory";
import type { Vec } from "./sim/vec";
import type { Order, World } from "./sim/world";
import type { Skill } from "./tuning/skills";

/**
 * What the cursor holds besides the Held Item, which lives in the World. UI
 * state: the Save never keeps it.
 */
export type Cursor = {
  /** The Held Skill, until it lands on the Skill Bar or is let go of. */
  heldSkill: Skill | null;
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
  return { heldSkill: null };
}

/**
 * What a press of the left button does with Held Items and Held Skills.
 *
 * - On the Inventory panel, with nothing held, it lifts the Item there as
 *   the Held Item; with one held, it puts it down there.
 * - Off the panels with an Item held, it drops it, and orders nothing else.
 * - On a learned Skill in the Skill Tree, with no Item held, it picks it up
 *   as the Held Skill.
 * - With a Held Skill, on a Skill Bar slot it puts it there; anywhere else,
 *   the World too, it lets go of it, changing nothing.
 *
 * Any press on the panels and HUD is taken, its buttons left to the menus
 * unless it put down or let go of a Held Skill; a press over the World with
 * nothing held is not.
 */
export function pressCursor(
  cursor: Cursor,
  press: CursorPoint,
  { world, screen }: CursorScene,
): CursorOutcome {
  const { hit, at } = press;
  if (cursor.heldSkill !== null) return landHeldSkill(cursor.heldSkill, hit);
  if (hit === null) return { cursor, orders: [], taken: false };
  if (!("button" in hit)) {
    const order = inventoryOrder(world, screen, at, hit);
    return { cursor, orders: order ? [order] : [], taken: true };
  }
  // The cursor holds a Held Item or a Held Skill, never both.
  if (hit.button?.type === "dragSkill" && cursorItemOf(world) === null) {
    return { cursor: { heldSkill: hit.button.skill }, orders: [], taken: true };
  }
  return { cursor, orders: [], taken: true };
}

/**
 * What a release of the left button, at a point or off the canvas (null),
 * does with Held Items and Held Skills.
 *
 * - A Held Skill lands in the Skill Bar slot there; over the Skill Tree spot
 *   it was picked up from it stays held, for a second click; anywhere else
 *   it is let go of, changing nothing.
 * - A Held Item stays held, for a second click to put it down.
 */
export function releaseCursor(
  cursor: Cursor,
  release: CursorPoint<Vec | null>,
  _scene: CursorScene,
): CursorOutcome {
  const { heldSkill } = cursor;
  if (heldSkill === null) return { cursor, orders: [], taken: false };
  const button = buttonOf(release.hit);
  // Released where it was picked up: a click, so it stays for the next one.
  if (button?.type === "dragSkill" && button.skill === heldSkill) {
    return { cursor, orders: [], taken: true };
  }
  return landHeldSkill(heldSkill, release.hit);
}

/**
 * Puts the Held Skill into the Skill Bar slot `hit`, or anywhere else lets
 * go of it, changing nothing. Either way the cursor is empty after, and the
 * press or release is not for the World.
 */
function landHeldSkill(heldSkill: Skill, hit: CursorHit | null): CursorOutcome {
  const button = buttonOf(hit);
  const orders: Order[] =
    button?.type === "skillBarSlot"
      ? [{ type: "PutSkillOnBar", skill: heldSkill, slot: button.slot }]
      : [];
  return { cursor: { heldSkill: null }, orders, taken: true };
}

/** The panel or HUD button `hit`, if it is one. */
function buttonOf(hit: CursorHit | null) {
  return hit && "button" in hit ? hit.button : null;
}

/** A pause or the Hero's Death lets go of the Held Skill. */
export function settleCursor(
  cursor: Cursor,
  { paused, heroDead }: { paused: boolean; heroDead: boolean },
): Cursor {
  return paused || heroDead ? { heldSkill: null } : cursor;
}

/**
 * What a point hits that isn't for the World, as `poll` needs it. Off the
 * panels with an Item held, the point hits a `DropHit`, which only a press
 * of the left button uses: it is still the World for a right-click's cast.
 */
export function forTheWorld(hit: CursorHit | null): CursorHit | null {
  return hit && "drop" in hit ? null : hit;
}
