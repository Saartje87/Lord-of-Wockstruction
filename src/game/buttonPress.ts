import type { CursorHit } from "./cursor";
import {
  acceptPendingPoints,
  addPendingPoint,
  clickClose,
  clickLevelUp,
  clickPanelButton,
  type Menus,
  removePendingPoint,
} from "./menus";
import type { Order, World } from "./sim/world";

/**
 * The button on a panel or the HUD a press landed on, as the cursor hits
 * it, or null between the buttons.
 */
export type PressedButton = Extract<CursorHit, { button: unknown }>["button"];

/**
 * A press on `button`, which never orders the Hero about, nor goes on from
 * their Death: Level Up opens the Hero or Skill Tree panel (but for a dead
 * Hero), a + on the Skill Tree spends a point while the Hero panel's +, −
 * and Accept plan and spend Pending Attribute Points, and a panel's × or
 * Panel button shuts it as its key does (a Panel button opening it too),
 * while the game runs on. Changes `menus` and gives the orders to send;
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
    case "panelButton":
      clickPanelButton(menus, button.panel, { heroDead });
      return [];
    case "learn":
      return [{ type: "SpendSkillPoint", skill: button.skill }];
    default:
      return [];
  }
}
