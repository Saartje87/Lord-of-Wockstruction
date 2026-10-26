import { createPause, type Pause, togglePause } from "./pause";
import {
  ATTRIBUTES,
  type Attribute,
  type Order,
  type SimEvent,
} from "./sim/world";

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
  /**
   * The Pending Attribute Points on each Attribute in the Hero panel, not
   * spent until Accept, and cancelled as the panel shuts. Never in the World
   * or the Save.
   */
  pendingPoints: PendingPoints;
};

/** A count of Pending Attribute Points on each Attribute. */
export type PendingPoints = Record<Attribute, number>;

export function createMenus(): Menus {
  return {
    pause: createPause(),
    heroPanelOpen: false,
    inventoryOpen: false,
    skillTreeOpen: false,
    pendingPoints: noPendingPoints(),
  };
}

/** No Pending Attribute Points, on any Attribute. */
export function noPendingPoints(): PendingPoints {
  return Object.fromEntries(
    ATTRIBUTES.map((attribute) => [attribute, 0]),
  ) as PendingPoints;
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
  const panel = panelOfKey(letter);
  if (panel) {
    togglePanel(menus, panel, hero);
    return "handled";
  }
  return null;
}

/**
 * The key that opens and shuts each panel, as `pressKey` reads it: lower
 * case.
 */
export const PANEL_KEYS: Record<Panel, string> = {
  hero: "c",
  inventory: "i",
  skillTree: "t",
};

/** The panel `letter` opens and shuts, if any. */
function panelOfKey(letter: string): Panel | undefined {
  return (Object.keys(PANEL_KEYS) as Panel[]).find(
    (panel) => PANEL_KEYS[panel] === letter,
  );
}

/** Whether `panel` is open. */
export function panelOpen(menus: Menus, panel: Panel): boolean {
  if (panel === "hero") return menus.heroPanelOpen;
  if (panel === "inventory") return menus.inventoryOpen;
  return menus.skillTreeOpen;
}

/**
 * A click on a Panel button, which opens or shuts its panel just as its key
 * (C, I or T) does: nothing while `hero` lies dead.
 */
export function clickPanelButton(menus: Menus, panel: Panel, hero: HeroState) {
  togglePanel(menus, panel, hero);
}

/**
 * Opens or shuts `panel`, by its key or its Panel button: the Inventory and
 * Skill Tree panels shut each other, and nothing opens or shuts while
 * `hero` lies dead.
 */
function togglePanel(menus: Menus, panel: Panel, hero: HeroState) {
  if (hero.heroDead) return;
  if (panelOpen(menus, panel)) shutPanel(menus, panel);
  else if (panel === "hero") menus.heroPanelOpen = true;
  else if (panel === "inventory") openInventory(menus);
  else openSkillTree(menus);
}

/** Opens the Inventory panel, shutting the Skill Tree panel in its place. */
function openInventory(menus: Menus) {
  menus.inventoryOpen = true;
  menus.skillTreeOpen = false;
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
 * A panel with an × close button in its top-right corner and a Panel button
 * on the HUD.
 */
export type Panel = "hero" | "inventory" | "skillTree";

/**
 * A click on a panel's × button, which shuts it as its key (C, I or T)
 * would, but never opens it.
 */
export function clickClose(menus: Menus, panel: Panel) {
  shutPanel(menus, panel);
}

/** Shuts `panel`, the Hero panel cancelling its Pending Attribute Points. */
function shutPanel(menus: Menus, panel: Panel) {
  if (panel === "hero") shutHeroPanel(menus);
  if (panel === "inventory") menus.inventoryOpen = false;
  if (panel === "skillTree") menus.skillTreeOpen = false;
}

/** Shuts the Hero panel, cancelling its Pending Attribute Points. */
function shutHeroPanel(menus: Menus) {
  menus.heroPanelOpen = false;
  menus.pendingPoints = noPendingPoints();
}

/**
 * The Attribute Points left to place: of the Hero's `attributePoints`
 * unspent, those not pending.
 */
export function unplacedPoints(menus: Menus, attributePoints: number): number {
  return attributePoints - pendingTotal(menus.pendingPoints);
}

/** How many Pending Attribute Points there are on all Attributes together. */
export function pendingTotal(pending: Readonly<PendingPoints>): number {
  return ATTRIBUTES.reduce((sum, attribute) => sum + pending[attribute], 0);
}

/** Whether any Pending Attribute Point waits for Accept. */
export function hasPendingPoints(pending: Readonly<PendingPoints>): boolean {
  return pendingTotal(pending) > 0;
}

/**
 * A click on an Attribute's +, putting a Pending Attribute Point on it while
 * any of `hero`'s unspent points are left to place and they live.
 */
export function addPendingPoint(
  menus: Menus,
  attribute: Attribute,
  hero: HeroState & { attributePoints: number },
) {
  if (hero.heroDead) return;
  if (unplacedPoints(menus, hero.attributePoints) <= 0) return;
  menus.pendingPoints[attribute] += 1;
}

/**
 * A click on an Attribute's −, taking a Pending Attribute Point back off it,
 * if it has one: never below the Attribute's accepted value.
 */
export function removePendingPoint(menus: Menus, attribute: Attribute) {
  if (menus.pendingPoints[attribute] > 0) menus.pendingPoints[attribute] -= 1;
}

/**
 * A click on Accept: the order spending every Pending Attribute Point at
 * once, which clears them, or null while none are pending.
 */
export function acceptPendingPoints(menus: Menus): Order | null {
  if (!hasPendingPoints(menus.pendingPoints)) return null;
  const points = menus.pendingPoints;
  menus.pendingPoints = noPendingPoints();
  return { type: "SpendAttributePoints", points };
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
  shutHeroPanel(menus);
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
