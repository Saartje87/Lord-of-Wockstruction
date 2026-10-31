import type { FocusSpot } from "../input/focus";
import type { ClosablePanel, PendingPoints } from "../menus";
import type { World } from "../sim/world";
import { type Branch, DEFAULT_BRANCH } from "../tuning/skills";
import type { Viewport } from "../viewport";
import { dialogueFocusSpots } from "./dialoguePanel";
import { heroFocusSpots } from "./heroPanel";
import { inventoryFocusSpots } from "./inventoryPanel";
import { questFocusSpots } from "./questPanel";
import { skillTreeFocusSpots } from "./skillTreePanel";
import { vendorFocusSpots } from "./vendorPanel";
import { waypointListFocusSpots } from "./waypointList";

/**
 * The Focus spots of `panel`, as laid out on `screen` for `world` and the
 * Hero panel's `pending` points and the NPC the Dialogue panel is with: none for no panel.
 */
export function panelFocusSpots(
  panel: ClosablePanel | null,
  world: World,
  screen: Viewport,
  pending?: Readonly<PendingPoints>,
  dialogueNpc = 0,
  dialoguePage = 0,
  skillTreeBranch: Branch = DEFAULT_BRANCH,
): FocusSpot[] {
  switch (panel) {
    case "hero":
      return heroFocusSpots(world, screen, pending);
    case "inventory":
      return inventoryFocusSpots(world, screen);
    case "skillTree":
      return skillTreeFocusSpots(world, screen, skillTreeBranch);
    case "quest":
      return questFocusSpots(world, screen);
    case "dialogue":
      return dialogueFocusSpots(world, screen, dialogueNpc, dialoguePage);
    case "vendor":
      return vendorFocusSpots(world, screen);
    case "waypoints":
      return waypointListFocusSpots(world, screen);
    default:
      return [];
  }
}
