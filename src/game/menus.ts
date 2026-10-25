import { createPause, type Pause, togglePause } from "./pause";
import type { SimEvent } from "./sim/world";

/**
 * What the player opens over the World, by key or by click: the pause menu,
 * the Hero panel and the Inventory panel.
 */
export type Menus = {
  pause: Pause;
  heroPanelOpen: boolean;
  inventoryOpen: boolean;
  /**
   * Whether the Hero lies dead, from their Death until they arrive back in
   * Town: the panels stay shut until then.
   */
  heroDead: boolean;
};

export function createMenus(): Menus {
  return {
    pause: createPause(),
    heroPanelOpen: false,
    inventoryOpen: false,
    heroDead: false,
  };
}

/**
 * The pause menu's buttons: New Hero asks to confirm one, and then
 * `confirm` starts it while `goBack` returns to the menu.
 */
export type MenuChoice = "newHero" | "confirm" | "goBack";

/**
 * A key pressed at real time `nowMs`, by `KeyboardEvent.key`. Esc opens and
 * closes the pause menu, and C the Hero panel and I the Inventory panel
 * while the game runs; while the Hero lies dead, C and I are taken but open
 * nothing. In the
 * menu, N asks to confirm a New Hero, and then Y confirms it while N or Esc
 * goes back. Returns `"newHero"` once confirmed, for the caller to start
 * one, `"handled"` for any other key the menus took, and null for a key
 * they leave to the game.
 */
export function pressKey(
  menus: Menus,
  key: string,
  nowMs: number,
): "newHero" | "handled" | null {
  const { pause } = menus;
  const letter = key.toLowerCase();
  if (pause.confirming) {
    if (letter === "y") return choose(menus, "confirm", nowMs) ?? "handled";
    if (letter === "n" || key === "Escape") choose(menus, "goBack", nowMs);
    return "handled";
  }
  if (key === "Escape") {
    togglePause(pause, nowMs);
    return "handled";
  }
  if (pause.paused) {
    if (letter === "n") choose(menus, "newHero", nowMs);
    return "handled";
  }
  if ((letter === "c" || letter === "i") && menus.heroDead) return "handled";
  if (letter === "c") {
    menus.heroPanelOpen = !menus.heroPanelOpen;
    return "handled";
  }
  if (letter === "i") {
    menus.inventoryOpen = !menus.inventoryOpen;
    return "handled";
  }
  return null;
}

/**
 * A click on the Level Up button, which opens the Hero panel, but for
 * nothing while the Hero lies dead.
 */
export function clickLevelUp(menus: Menus) {
  if (!menus.heroDead) menus.heroPanelOpen = true;
}

/**
 * Follows what happened in a step of the World: the Hero's Death closes the
 * Hero and Inventory panels, which stay shut until the Hero arrives in an
 * Area again, back in Town after `Continue`.
 */
export function reactMenus(menus: Menus, events: readonly SimEvent[]) {
  for (const event of events) {
    if (event.type === "HeroDied") {
      menus.heroDead = true;
      menus.heroPanelOpen = false;
      menus.inventoryOpen = false;
    }
    if (event.type === "AreaChanged") menus.heroDead = false;
  }
}

/**
 * A click at real time `nowMs` while paused, on one of the menu's buttons
 * or, for null, anywhere else, which resumes. Returns `"newHero"` once one
 * is confirmed, for the caller to start it.
 */
export function clickPaused(
  menus: Menus,
  choice: MenuChoice | null,
  nowMs: number,
): "newHero" | null {
  if (choice === null) {
    togglePause(menus.pause, nowMs);
    return null;
  }
  return choose(menus, choice, nowMs);
}

/** Picks a pause-menu button, by key or by click. */
function choose(
  menus: Menus,
  choice: MenuChoice,
  nowMs: number,
): "newHero" | null {
  const { pause } = menus;
  switch (choice) {
    case "newHero":
      pause.confirming = true;
      return null;
    case "goBack":
      pause.confirming = false;
      return null;
    case "confirm":
      if (!pause.confirming) return null;
      // Starts afresh, alive, with nothing open.
      togglePause(pause, nowMs);
      menus.heroPanelOpen = false;
      menus.inventoryOpen = false;
      menus.heroDead = false;
      return "newHero";
  }
}
