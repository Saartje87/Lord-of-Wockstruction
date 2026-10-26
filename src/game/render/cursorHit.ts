import type { CursorHit } from "../cursor";
import type { Menus } from "../menus";
import { beltRows } from "../sim/belt";
import { cursorItemOf } from "../sim/inventory";
import type { Vec } from "../sim/vec";
import type { World } from "../sim/world";
import type { Viewport } from "../viewport";
import { beltStripHitAt } from "./beltStrip";
import { panelHitAt } from "./heroPanel";
import { inventoryHitAt } from "./inventoryPanel";
import { panelButtonHitAt } from "./panelButtons";
import { skillBarHitAt } from "./skillBar";
import { skillTreeHitAt } from "./skillTreePanel";

/** The panels as drawn: which are open, and the Hero panel's Pending Attribute Points. */
export type ShownPanels = Pick<
  Menus,
  "heroPanelOpen" | "inventoryOpen" | "skillTreeOpen" | "pendingPoints"
>;

/**
 * What a point on the screen hits of the panels and the HUD, or null when
 * it's for the World. An open panel is drawn over the HUD, so it takes a
 * point over both before the Skill Bar, the Belt strip and the Panel
 * buttons do; off the Inventory panel with an Item held, a point on none of
 * them is a drop.
 */
export function cursorHitAt(
  screen: Viewport,
  point: Vec,
  world: World,
  shown: ShownPanels,
): CursorHit | null {
  const rows = beltRows(world);
  const { inventoryOpen } = shown;
  const holding = cursorItemOf(world) !== null;
  return (
    panelHitAt(
      screen,
      point,
      world,
      shown.heroPanelOpen,
      shown.pendingPoints,
    ) ??
    skillTreeHitAt(screen, point, world, shown.skillTreeOpen) ??
    // Only on the panel itself here: off it, the HUD comes before a drop.
    inventoryHitAt(screen, point, inventoryOpen, false, rows) ??
    skillBarHitAt(screen, point) ??
    beltStripHitAt(screen, point) ??
    panelButtonHitAt(screen, point) ??
    inventoryHitAt(screen, point, inventoryOpen, holding, rows)
  );
}
