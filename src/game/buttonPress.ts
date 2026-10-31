import type { CursorHit } from "./cursor";
import {
  acceptPendingPoints,
  addPendingPoint,
  clickClose,
  clickLevelUp,
  clickMiniMap,
  clickPanelButton,
  clickTrade,
  type Menus,
  removePendingPoint,
} from "./menus";
import { inTown, type Order, type World } from "./sim/world";

/**
 * The button on a panel or the HUD a press landed on, as the cursor hits
 * it, or null between the buttons.
 */
export type PressedButton = Extract<CursorHit, { button: unknown }>["button"];

/**
 * A press on `button`, which never orders the Hero about, nor goes on from
 * their Death: Level Up opens the Hero or Skill Tree panel (but for a dead
 * Hero), a Branch tab opens its Branch on the Skill Tree panel, a + on it spends a point while the Hero panel's +, −
 * and Accept plan and spend Pending Attribute Points, and a panel's × or
 * Panel button shuts it as its key does (a Panel button opening it too),
 * while the game runs on, and the Town Portal button opens a Town Portal
 * as its key does, but in Town, and the Mini Map opens the Map Overlay.
 * Changes `menus` and gives the orders to send;
 * other buttons, and null between them, do nothing here.
 */
export function pressButton(
  menus: Menus,
  world: World,
  button: PressedButton,
): Order[] {
  const heroDead = world.death !== null;
  const { attributePoints, skillPoints } = world.hero.progress;
  switch (button?.type) {
    case "levelUp":
      clickLevelUp(menus, { heroDead, attributePoints, skillPoints });
      return [];
    // + and − only plan Pending Attribute Points; Accept spends them.
    case "raise":
      addPendingPoint(menus, button.attribute, { heroDead, attributePoints });
      return [];
    case "lower":
      removePendingPoint(menus, button.attribute);
      return [];
    case "accept": {
      const accept = acceptPendingPoints(menus);
      return accept ? [accept] : [];
    }
    case "close":
      clickClose(menus, button.panel);
      return [];
    case "miniMap":
      clickMiniMap(menus, { heroDead });
      return [];
    case "panelButton":
      clickPanelButton(menus, button.panel, { heroDead });
      return [];
    case "branchTab":
      menus.skillTreeBranch = button.branch;
      return [];
    case "learn":
      return [{ type: "SpendSkillPoint", skill: button.skill }];
    case "travel":
      // The list shuts as the Hero leaves; shutting it now keeps it from
      // showing over the fade.
      clickClose(menus, "waypoints");
      return heroDead ? [] : [{ type: "TravelToWaypoint", area: button.area }];
    case "acceptQuest":
      return heroDead ? [] : [{ type: "AcceptQuest", quest: button.quest }];
    case "handInQuest":
      return heroDead ? [] : [{ type: "HandInQuest", quest: button.quest }];
    case "smithService":
      menus.dialoguePage = 1;
      return [];
    case "smithMore":
      menus.dialoguePage += 1;
      return [];
    case "smithForge":
      return heroDead ? [] : [{ type: "SmithBonus", item: button.item }];
    case "trade":
      clickTrade(menus);
      return [];
    case "goodbye":
      clickClose(menus, "dialogue");
      return [];
    case "townPortal":
      return heroDead || inTown(world) ? [] : [{ type: "OpenTownPortal" }];
    default:
      return [];
  }
}
