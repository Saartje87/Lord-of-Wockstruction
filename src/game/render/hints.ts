import type { InputWay } from "../input/activeInput";
import type { PadButton } from "../input/pad";
import { type MenuChoice, PANEL_KEYS, type Panel } from "../menus";
import { beltColumnKey } from "../sim/belt";
import { type SkillBarSlot, slotKey } from "../sim/skillBar";

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

/** The pad button that casts each Skill Bar slot's Skill. */
const SLOT_BUTTONS: Record<SkillBarSlot, PadButton> = {
  key1: "x",
  key2: "y",
  key3: "b",
  key4: "rb",
  right: "rt",
};

/** The D-pad direction that drinks from each Belt Column, from the left. */
const BELT_BUTTONS: readonly PadButton[] = ["left", "up", "right", "down"];

/**
 * The button shown on a Skill Bar slot with the Active Input `way`: its key
 * or right-click, its controller button, or nothing for touch.
 */
export function skillBarSlotButton(slot: SkillBarSlot, way: InputWay): string {
  if (way === "controller") return PAD_BUTTON_NAMES[SLOT_BUTTONS[slot]];
  if (way === "touch") return "";
  return slot === "right" ? "RMB" : slotKey(slot);
}

/**
 * The button shown on a Belt Column's square of the Belt strip with `way`:
 * its key, its D-pad direction, or nothing for touch.
 */
export function beltColumnButton(column: number, way: InputWay): string {
  if (way === "controller") return PAD_BUTTON_NAMES[BELT_BUTTONS[column]];
  if (way === "touch") return "";
  return beltColumnKey(column);
}

/** How to close `panel` with `way`; nothing for touch, which taps its ×. */
export function panelCloseHint(panel: Panel, way: InputWay): string {
  if (way === "touch") return "";
  const button =
    way === "controller" ? PAD_BUTTON_NAMES.b : PANEL_KEYS[panel].toUpperCase();
  return `Press ${button} to close`;
}

/** How to go on from the Hero's Death back to Town with `way`. */
export function deathHint(way: InputWay): string {
  if (way === "controller")
    return `Press ${PAD_BUTTON_NAMES.a} to return to Town`;
  if (way === "touch") return "Tap to return to Town";
  return "Click to return to Town";
}

/**
 * How to leave the pause menu with `way`, or, while `confirming` a New Hero,
 * the way back that isn't the No button: Esc goes back from the question
 * rather than resuming, as Menu and B do.
 */
export function resumeHint(confirming: boolean, way: InputWay): string {
  if (way === "controller") {
    return confirming
      ? `Press ${PAD_BUTTON_NAMES.b} to go back`
      : `Press ${PAD_BUTTON_NAMES.menu} or ${PAD_BUTTON_NAMES.b} to resume`;
  }
  if (way === "touch") return "Tap elsewhere to resume";
  return confirming
    ? "Click elsewhere to resume"
    : "Click elsewhere or press Esc to resume";
}

/** Each pause-menu button's label, without its key. */
const MENU_LABELS: Record<MenuChoice, string> = {
  newHero: "New Hero",
  confirm: "Yes",
  goBack: "No",
};

/** The key that presses each pause-menu button. */
const MENU_KEYS: Record<MenuChoice, string> = {
  newHero: "N",
  confirm: "Y",
  goBack: "N",
};

/**
 * A pause-menu button's label with `way`: with its key, with B on No for a
 * controller (A presses the picked one), or bare for touch.
 */
export function menuChoiceLabel(choice: MenuChoice, way: InputWay): string {
  const label = MENU_LABELS[choice];
  if (way === "mouseAndKeyboard") return `${label} (${MENU_KEYS[choice]})`;
  if (way === "controller" && choice === "goBack") {
    return `${label} (${PAD_BUTTON_NAMES.b})`;
  }
  return label;
}
