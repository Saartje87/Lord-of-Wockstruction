import { createPause, type Pause, togglePause } from "./pause";
import type { SimEvent } from "./sim/world";

/**
 * What the player opens over the World, by key or by click: the pause menu,
 * the Hero panel, and the Inventory or Skill Tree panel, which share the
 * right of the screen, so one opening shuts the other.
 */
export type Menus = {
  pause: Pause;
  heroPanelOpen: boolean;
  inventoryOpen: boolean;
  skillTreeOpen: boolean;
};

export function createMenus(): Menus {
  return {
    pause: createPause(),
    heroPanelOpen: false,
    inventoryOpen: false,
    skillTreeOpen: false,
  };
}

/**
 * What the menus are told of the World: whether the Hero lies dead, from
 * their Death until they arrive back in Town. The panels stay shut then.
 */
export type HeroState = { heroDead: boolean };

/**
 * The pause menu's buttons: New Hero asks to confirm one, and then
 * `confirm` starts it while `goBack` returns to the menu.
 */
export type MenuChoice = "newHero" | "confirm" | "goBack";

/**
 * A key pressed at real time `nowMs`, by `KeyboardEvent.key`. Esc opens and
 * closes the pause menu, and C the Hero panel, I the Inventory panel and T
 * the Skill Tree panel while the game runs; while `hero` lies dead, C, I and
 * T are taken but open nothing. In the menu, N asks to confirm a New Hero, and then Y confirms it while N or Esc
 * goes back. Returns `"newHero"` once confirmed, for the caller to start
 * one, `"handled"` for any other key the menus took, and null for a key
 * they leave to the game.
 */
export function pressKey(
  menus: Menus,
  key: string,
  nowMs: number,
  hero: HeroState,
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
  const panelKey = letter === "c" || letter === "i" || letter === "t";
  if (panelKey && hero.heroDead) return "handled";
  if (letter === "c") {
    menus.heroPanelOpen = !menus.heroPanelOpen;
    return "handled";
  }
  if (letter === "i") {
    menus.inventoryOpen = !menus.inventoryOpen;
    if (menus.inventoryOpen) menus.skillTreeOpen = false;
    return "handled";
  }
  if (letter === "t") {
    if (menus.skillTreeOpen) menus.skillTreeOpen = false;
    else openSkillTree(menus);
    return "handled";
  }
  return null;
}

/** Opens the Skill Tree panel, shutting the Inventory panel in its place. */
function openSkillTree(menus: Menus) {
  menus.skillTreeOpen = true;
  menus.inventoryOpen = false;
}

/**
 * A click on the Level Up button, which opens the Hero panel while
 * Attribute Points are unspent and the Skill Tree panel while Skill Points
 * are, but nothing while `hero` lies dead.
 */
export function clickLevelUp(
  menus: Menus,
  hero: HeroState & { attributePoints: number; skillPoints: number },
) {
  if (hero.heroDead) return;
  if (hero.attributePoints > 0) menus.heroPanelOpen = true;
  if (hero.skillPoints > 0) openSkillTree(menus);
}

/**
 * Follows what happened in a step of the World: the Hero's Death closes the
 * panels.
 */
export function reactMenus(menus: Menus, events: readonly SimEvent[]) {
  for (const event of events) {
    if (event.type === "HeroDied") closePanels(menus);
  }
}

/** Shuts the Hero, Inventory and Skill Tree panels. */
function closePanels(menus: Menus) {
  menus.heroPanelOpen = false;
  menus.inventoryOpen = false;
  menus.skillTreeOpen = false;
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
      // Starts afresh with nothing open.
      togglePause(pause, nowMs);
      closePanels(menus);
      return "newHero";
  }
}
