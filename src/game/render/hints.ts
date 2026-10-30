import type { InputWay } from "../input/activeInput";
import { TOWN_PORTAL_KEY } from "../input/keys";
import {
  castButton,
  drinkButton,
  type PadButton,
  TOWN_PORTAL_PAD_BUTTON,
} from "../input/pad";
import {
  type ClosablePanel,
  MAP_KEY,
  type MenuChoice,
  PANEL_KEYS,
} from "../menus";
import { beltColumnKey } from "../sim/belt";
import { type SkillBarSlot, slotKey } from "../sim/skillBar";
import type { SkillSheet } from "./skillTreePanel";

/** Each pad button's Xbox-style name, whatever the controller. */
const PAD_BUTTON_NAMES: Record<PadButton, string> = {
  a: "A",
  b: "B",
  x: "X",
  y: "Y",
  lb: "LB",
  rb: "RB",
  lt: "LT",
  rt: "RT",
  view: "View",
  menu: "Menu",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

/**
 * The button shown on a Skill Bar slot with the Active Input `way`: its key
 * or right-click, its controller button, or nothing for touch.
 */
export function skillBarSlotButton(slot: SkillBarSlot, way: InputWay): string {
  if (way === "controller") return PAD_BUTTON_NAMES[castButton(slot)];
  if (way === "touch") return "";
  return slot === "right" ? "RMB" : slotKey(slot);
}

/**
 * The button shown on a Belt Column's square of the Belt strip with `way`:
 * its key, its D-pad direction, or nothing for touch.
 */
export function beltColumnButton(column: number, way: InputWay): string {
  if (way === "controller") return PAD_BUTTON_NAMES[drinkButton(column)];
  if (way === "touch") return "";
  return beltColumnKey(column);
}

/** How to close `panel` with `way`; nothing for touch, which taps its ×. */
export function panelCloseHint(panel: ClosablePanel, way: InputWay): string {
  if (way === "touch") return "";
  // A World panel has no key of its own: Esc shuts it.
  const key = panel === "waypoints" ? "Esc" : PANEL_KEYS[panel].toUpperCase();
  const button = way === "controller" ? PAD_BUTTON_NAMES.b : key;
  return `Press ${button} to close`;
}

/**
 * The Town Portal button's tooltip with `way`: its name with its key or
 * controller button, or bare for touch, which taps it.
 */
export function townPortalTooltip(way: InputWay): string {
  if (way === "touch") return "Town Portal";
  const button =
    way === "controller"
      ? PAD_BUTTON_NAMES[TOWN_PORTAL_PAD_BUTTON]
      : TOWN_PORTAL_KEY.toUpperCase();
  return `Town Portal (${button})`;
}

/**
 * The Mini Map's tooltip with `way`: the Map Overlay's name with its key or
 * controller button, or empty for touch, which has no hover to show it on.
 */
export function mapTooltip(way: InputWay): string {
  if (way === "touch") return "";
  return `Map (${way === "controller" ? PAD_BUTTON_NAMES.lt : MAP_KEY})`;
}

/** How to go on from the Hero's Death back to Town with `way`. */
export function deathHint(way: InputWay): string {
  return DEATH_HINTS[way];
}

/** The Death screen's hint with each way. */
const DEATH_HINTS: Record<InputWay, string> = {
  mouseAndKeyboard: "Click to return to Town",
  controller: `Press ${PAD_BUTTON_NAMES.a} to return to Town`,
  touch: "Tap to return to Town",
};

/** How to leave the pause menu with `way`. */
export function resumeHint(way: InputWay): string {
  if (way === "controller") {
    return `Press ${PAD_BUTTON_NAMES.menu} or ${PAD_BUTTON_NAMES.b} to resume`;
  }
  if (way === "touch") return "Tap elsewhere to resume";
  return "Click elsewhere or press Esc to resume";
}

/** A pause-menu button pressed by a key as well, as New Hero is by N. */
type KeyedMenuChoice = Exclude<MenuChoice, "fullscreen">;

/** Each keyed pause-menu button's label, without its key. */
const MENU_LABELS: Record<KeyedMenuChoice, string> = {
  continue: "Continue",
  newHero: "New Hero",
  quit: "Quit to Start Screen",
  confirm: "Yes",
  goBack: "No",
};

/** The key that presses each keyed pause-menu button. */
const MENU_KEYS: Record<KeyedMenuChoice, string> = {
  continue: "C",
  newHero: "N",
  quit: "Q",
  confirm: "Y",
  goBack: "N",
};

/**
 * The Fullscreen button's label, whatever the way: what choosing it does
 * while the game is fullscreen (`on`) or not.
 */
export function fullscreenLabel(on: boolean): string {
  return on ? "Exit fullscreen" : "Fullscreen";
}

/**
 * A pause-menu button's label with `way`: with its key, with B on No for a
 * controller (A presses the picked one), or bare for touch. The Fullscreen
 * button has no key, and reads as `fullscreenOn` says.
 */
export function menuChoiceLabel(
  choice: MenuChoice,
  way: InputWay,
  fullscreenOn: boolean,
): string {
  if (choice === "fullscreen") return fullscreenLabel(fullscreenOn);
  const label = MENU_LABELS[choice];
  if (way === "mouseAndKeyboard") return `${label} (${MENU_KEYS[choice]})`;
  if (way === "controller" && choice === "goBack") {
    return `${label} (${PAD_BUTTON_NAMES.b})`;
  }
  return label;
}

/**
 * How to spend a Skill Point on a Skill and how to pick it up, with each
 * way; none for touch, whose hints name no gesture.
 */
const SKILL_ACTIONS: Record<
  InputWay,
  { learn: string; pickUp: string } | null
> = {
  mouseAndKeyboard: { learn: "Click +", pickUp: "Click" },
  controller: {
    learn: `Press ${PAD_BUTTON_NAMES.a}`,
    pickUp: `Press ${PAD_BUTTON_NAMES.x}`,
  },
  touch: null,
};

/**
 * A Skill's tooltip with `way`: its name and Skill Level, then, but for
 * touch, how to spend a Skill Point on it while one can be, and how to put
 * it on the Skill Bar once learned.
 */
export function skillTooltip(sheet: SkillSheet, way: InputWay): string[] {
  const lines = [sheet.name, `Skill Level ${sheet.skillLevel}`];
  const actions = SKILL_ACTIONS[way];
  if (!actions) return lines;
  const { learn, pickUp } = actions;
  if (sheet.canRaise) lines.push(`${learn} to spend a Skill Point`);
  if (sheet.skillLevel !== "0") lines.push(`${pickUp} to put on the Skill Bar`);
  return lines;
}
