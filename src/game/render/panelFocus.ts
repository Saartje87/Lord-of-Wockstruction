import type { FocusSpot } from "../input/focus";
import type { Panel, PendingPoints } from "../menus";
import type { World } from "../sim/world";
import type { Viewport } from "../viewport";
import { heroFocusSpots } from "./heroPanel";
import { inventoryFocusSpots } from "./inventoryPanel";
import { skillTreeFocusSpots } from "./skillTreePanel";

/**
 * The Focus spots of `panel`, as laid out on `screen` for `world` and the
 * Hero panel's `pending` points: none for no panel.
 */
export function panelFocusSpots(
  panel: Panel | null,
  world: World,
  screen: Viewport,
  pending?: Readonly<PendingPoints>,
): FocusSpot[] {
  switch (panel) {
    case "hero":
      return heroFocusSpots(world, screen, pending);
    case "inventory":
      return inventoryFocusSpots(world, screen);
    case "skillTree":
      return skillTreeFocusSpots(world, screen);
    default:
      return [];
  }
}
