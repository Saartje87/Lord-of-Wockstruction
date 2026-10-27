import type { FocusSpot } from "../input/focus";
import type { Panel } from "../menus";
import type { World } from "../sim/world";
import type { Viewport } from "../viewport";
import { inventoryFocusSpots } from "./inventoryPanel";

/**
 * The Focus spots of `panel`, as laid out on `screen` for `world`: none for
 * no panel, or one with no Focus spots yet.
 */
export function panelFocusSpots(
  panel: Panel | null,
  world: World,
  screen: Viewport,
): FocusSpot[] {
  if (panel === "inventory") return inventoryFocusSpots(world, screen);
  return [];
}
