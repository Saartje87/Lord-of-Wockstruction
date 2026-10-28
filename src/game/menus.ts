import { type Fullscreen, NO_FULLSCREEN } from "./fullscreen";
import { DIRECTIONS, type PadButton } from "./input/pad";
import { createPause, type Pause, togglePause } from "./pause";
import {
  ATTRIBUTES,
  type Attribute,
  type Order,
  type SimEvent,
} from "./sim/world";
import type { Viewport } from "./viewport";

/**
 * What the player opens over the World, by key or by click: the pause menu,
 * the Hero panel, and the Inventory or Skill Tree panel, which share the
 * right of the screen, so one opening shuts the other. In the Compact
 * Layout each panel fills the screen, so any one opening shuts the others.
 */
export type Menus = {
  pause: Pause;
  heroPanelOpen: boolean;
  inventoryOpen: boolean;
  skillTreeOpen: boolean;
  /**
   * Whether the Map Overlay is open. It is not a panel: the World runs on
   * under it, and the panels open and shut alongside it.
   */
  mapOpen: boolean;
  /**
   * The Pending Attribute Points on each Attribute in the Hero panel, not
   * spent until Accept, and cancelled as the panel shuts. Never in the World
   * or the Save.
   */
  pendingPoints: PendingPoints;
  /** Whether the screen takes the Compact Layout, as last fitted. */
  compact: boolean;
  /** The panel opened most recently, which a short screen keeps. */
  lastOpened: Panel | null;
  /**
   * Whether the Rotate Notice shows instead of the game, as last fitted:
   * the World is paused, and keys and clicks do nothing.
   */
  rotateNotice: boolean;
  /**
   * Whether the Rotate Notice paused the World, rather than finding the
   * pause menu open, so its going away resumes it.
   */
  pausedForNotice: boolean;
  /**
   * The pause-menu button a controller has picked, for A to press: null
   * until the controller first touches the menu.
   */
  menuFocus: MenuChoice | null;
  /**
   * Whether the browser allows fullscreen and whether the game is
   * fullscreen, as the game loop last read them from the browser.
   */
  fullscreen: Fullscreen;
};

/** A count of Pending Attribute Points on each Attribute. */
export type PendingPoints = Record<Attribute, number>;

export function createMenus(): Menus {
  return {
    pause: createPause(),
    heroPanelOpen: false,
    inventoryOpen: false,
    skillTreeOpen: false,
    mapOpen: false,
    pendingPoints: noPendingPoints(),
    compact: false,
    lastOpened: null,
    rotateNotice: false,
    pausedForNotice: false,
    menuFocus: null,
    fullscreen: NO_FULLSCREEN,
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
 * `confirm` starts it while `goBack` returns to the menu; the Fullscreen
 * button asks to go in or out of fullscreen.
 */
export type MenuChoice = "newHero" | "confirm" | "goBack" | "fullscreen";

/** The Fullscreen button, the Rotate Notice's one choice. */
export type FullscreenChoice = Extract<MenuChoice, "fullscreen">;

/**
 * What the menus ask the game loop to carry out: start a New Hero, or take
 * the game in or out of fullscreen.
 */
export type MenuRequest = "newHero" | "fullscreen";

/**
 * The pause menu's buttons in their row from left to right: New Hero, and
 * the Fullscreen button where `fullscreen` says the browser allows it, or
 * Yes and No while `confirming` a New Hero.
 */
export function menuChoices(
  confirming: boolean,
  fullscreen: Fullscreen,
): MenuChoice[] {
  if (confirming) return ["confirm", "goBack"];
  return fullscreen.available ? ["newHero", "fullscreen"] : ["newHero"];
}

/**
 * A key pressed at real time `nowMs`, by `KeyboardEvent.key`. Esc opens and
 * closes the pause menu, and C the Hero panel, I the Inventory panel and T
 * the Skill Tree panel while the game runs; while `hero` lies dead, C, I and
 * T are taken but open nothing. Tab opens and closes the Map Overlay, and
 * does nothing either while the Hero lies dead. While the Rotate Notice shows, every key
 * is taken and does nothing. In the menu, N asks to confirm a New Hero, and then Y confirms it while N or Esc
 * goes back. Returns `"newHero"` once confirmed, for the caller to start
 * one, `"handled"` for any other key the menus took, and null for a key
 * they leave to the game.
 */
export function pressKey(
  menus: Menus,
  key: string,
  nowMs: number,
  hero: HeroState,
): MenuRequest | "handled" | null {
  const { pause } = menus;
  if (menus.rotateNotice) return "handled";
  const letter = key.toLowerCase();
  if (pause.confirming) {
    if (letter === "y") return choose(menus, "confirm", nowMs) ?? "handled";
    if (letter === "n" || key === "Escape") choose(menus, "goBack", nowMs);
    return "handled";
  }
  if (key === "Escape") {
    togglePause(pause, nowMs);
    menus.menuFocus = null;
    return "handled";
  }
  if (pause.paused) {
    if (letter === "n") choose(menus, "newHero", nowMs);
    return "handled";
  }
  if (key === MAP_KEY) {
    if (!hero.heroDead) menus.mapOpen = !menus.mapOpen;
    return "handled";
  }
  const panel = panelOfKey(letter);
  if (panel) {
    togglePanel(menus, panel, hero);
    return "handled";
  }
  return null;
}

/** The key that opens and shuts the Map Overlay, as `pressKey` reads it. */
export const MAP_KEY = "Tab";

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

/** The flag on the menus that says whether each panel is open. */
const OPEN_FLAGS = {
  hero: "heroPanelOpen",
  inventory: "inventoryOpen",
  skillTree: "skillTreeOpen",
} as const satisfies Record<Panel, keyof Menus>;

/** The menus' flags for which panels are open. */
export type OpenPanels = Pick<Menus, (typeof OPEN_FLAGS)[Panel]>;

/** Whether `panel` is open. */
export function panelOpen(menus: OpenPanels, panel: Panel): boolean {
  return menus[OPEN_FLAGS[panel]];
}

/** Whether any panel is open. */
export function anyPanelOpen(menus: OpenPanels): boolean {
  return PANELS.some((panel) => panelOpen(menus, panel));
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
  if (hero.heroDead || menus.rotateNotice) return;
  if (panelOpen(menus, panel)) shutPanel(menus, panel);
  else openPanel(menus, panel);
}

/**
 * Opens `panel`, shutting the panels it can't be open with: the Inventory
 * and Skill Tree panels shut each other, and in the Compact Layout any
 * panel shuts the others.
 */
function openPanel(menus: Menus, panel: Panel) {
  for (const other of PANELS) {
    if (other !== panel && !canShareScreen(menus, panel, other)) {
      shutPanel(menus, other);
    }
  }
  menus[OPEN_FLAGS[panel]] = true;
  menus.lastOpened = panel;
}

/**
 * Whether `panel` may be open with `other`: only the Hero panel with
 * another, and never in the Compact Layout.
 */
function canShareScreen(menus: Menus, panel: Panel, other: Panel): boolean {
  return !menus.compact && (panel === "hero" || other === "hero");
}

/**
 * Fits the menus to the screen, as `viewport` lays it out at real time
 * `nowMs`: the Rotate Notice showing pauses the World and going away
 * resumes it, unless the pause menu was open before; crossing into the
 * Compact Layout keeps the panel opened most recently and shuts any other,
 * as shutting it by hand would.
 */
export function fitMenus(
  menus: Menus,
  viewport: Pick<Viewport, "compact" | "rotateNotice">,
  nowMs: number,
) {
  fitRotateNotice(menus, viewport.rotateNotice !== null, nowMs);
  menus.compact = viewport.compact;
  if (!menus.compact) return;
  const keep =
    menus.lastOpened && panelOpen(menus, menus.lastOpened)
      ? menus.lastOpened
      : PANELS.find((panel) => panelOpen(menus, panel));
  for (const panel of PANELS) {
    if (panel !== keep && panelOpen(menus, panel)) shutPanel(menus, panel);
  }
}

/**
 * Shows the Rotate Notice, or takes it away, at real time `nowMs`: it
 * pauses a running World, and resumes only a World it paused itself.
 */
function fitRotateNotice(menus: Menus, showing: boolean, nowMs: number) {
  if (showing === menus.rotateNotice) return;
  menus.rotateNotice = showing;
  if (showing && !menus.pause.paused) {
    togglePause(menus.pause, nowMs);
    menus.pausedForNotice = true;
  } else if (!showing && menus.pausedForNotice) {
    togglePause(menus.pause, nowMs);
    menus.pausedForNotice = false;
  }
}

/**
 * A click on the Level Up button, which opens the Hero panel while
 * Attribute Points are unspent and the Skill Tree panel while Skill Points
 * are, but nothing while `hero` lies dead. In the Compact Layout, with both
 * unspent, it opens only the Hero panel.
 */
export function clickLevelUp(
  menus: Menus,
  hero: HeroState & { attributePoints: number; skillPoints: number },
) {
  if (hero.heroDead || menus.rotateNotice) return;
  const attributes = hero.attributePoints > 0;
  if (hero.skillPoints > 0 && !(attributes && menus.compact)) {
    openPanel(menus, "skillTree");
  }
  if (attributes) openPanel(menus, "hero");
}

/**
 * A panel with an × close button in its top-right corner and a Panel button
 * on the HUD.
 */
export type Panel = "hero" | "inventory" | "skillTree";

/** The three panels, in their Panel buttons' order from left to right. */
export const PANELS: readonly Panel[] = ["hero", "inventory", "skillTree"];

/**
 * A click on a panel's × button, which shuts it as its key (C, I or T)
 * would, but never opens it.
 */
export function clickClose(menus: Menus, panel: Panel) {
  shutPanel(menus, panel);
}

/** Shuts `panel`, the Hero panel cancelling its Pending Attribute Points. */
function shutPanel(menus: Menus, panel: Panel) {
  menus[OPEN_FLAGS[panel]] = false;
  if (panel === "hero") menus.pendingPoints = noPendingPoints();
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
  for (const panel of PANELS) shutPanel(menus, panel);
}

/**
 * A click at real time `nowMs` while paused, on one of the menu's buttons
 * or, for null, anywhere else, which resumes; nothing while the Rotate
 * Notice shows. Returns `"newHero"` once one is confirmed, for the caller
 * to start it, and `"fullscreen"` on the Fullscreen button, for the caller
 * to take the game in or out of fullscreen, the menu staying open.
 */
export function clickPaused(
  menus: Menus,
  choice: MenuChoice | null,
  nowMs: number,
): MenuRequest | null {
  if (menus.rotateNotice) return null;
  menus.menuFocus = null;
  if (choice === null) {
    togglePause(menus.pause, nowMs);
    return null;
  }
  return choose(menus, choice, nowMs);
}

/**
 * A tap while the Rotate Notice shows, on its Fullscreen button (`choice`)
 * or, for null, anywhere else: the one input the notice lets through.
 * Returns `"fullscreen"` on the button where the browser allows it, for the
 * caller to take the game fullscreen, and otherwise null, taking the tap
 * for nothing. The pause stays as it was: the notice going away resumes the
 * World only if it paused it.
 */
export function tapRotateNotice(
  menus: Menus,
  choice: FullscreenChoice | null,
): MenuRequest | null {
  if (!menus.rotateNotice || !menus.fullscreen.available) return null;
  return choice;
}

/**
 * A controller button pressed at real time `nowMs`, as `pollPad` hands it
 * over. Menu opens and shuts the pause menu, picking New Hero; in it, the
 * D-pad (or the stick) moves between its buttons, A presses the one picked,
 * and Menu or B goes back from confirming a New Hero, as Esc does, or
 * resumes. While the game runs, View opens and shuts the Inventory panel,
 * and with a panel open, LB and RB move to the panel before or after it (in
 * Panel-button order, round from the last to the first), shutting it as
 * its key would, and B shuts it. While the Rotate Notice shows, every
 * button is taken and does nothing. Returns as `pressKey` does, or
 * `"fullscreen"` on A with the Fullscreen button picked, as `clickPaused`.
 */
export function pressPad(
  menus: Menus,
  button: PadButton,
  nowMs: number,
  hero: HeroState,
): MenuRequest | "handled" | null {
  const { pause } = menus;
  if (menus.rotateNotice) return "handled";
  if (pause.paused) return pressPaused(menus, button, nowMs);
  if (button === "menu") {
    togglePause(pause, nowMs);
    menus.menuFocus = "newHero";
    return "handled";
  }
  if (button === "view") {
    togglePanel(menus, "inventory", hero);
    return "handled";
  }
  const panel = currentPanel(menus);
  if (!panel) return null;
  if (button === "b") {
    shutPanel(menus, panel);
    return "handled";
  }
  if (button === "lb" || button === "rb") {
    const next = PANELS.indexOf(panel) + (button === "rb" ? 1 : -1);
    shutPanel(menus, panel);
    openPanel(menus, PANELS[(next + PANELS.length) % PANELS.length]);
    return "handled";
  }
  return null;
}

/** A controller button pressed in the pause menu, which takes them all. */
function pressPaused(
  menus: Menus,
  button: PadButton,
  nowMs: number,
): MenuRequest | "handled" {
  const { pause } = menus;
  const choices = menuChoices(pause.confirming, menus.fullscreen);
  const picked = menus.menuFocus;
  const at = picked === null ? -1 : choices.indexOf(picked);
  if (button === "menu" || button === "b") {
    if (pause.confirming) pickChoice(menus, "goBack", nowMs);
    else togglePause(pause, nowMs);
  } else if (at === -1 && (button === "a" || isDirection(button))) {
    menus.menuFocus = defaultChoice(pause.confirming);
  } else if (picked !== null && button === "a") {
    return pickChoice(menus, picked, nowMs) ?? "handled";
  } else if (button === "left" || button === "up") {
    menus.menuFocus = choices[Math.max(at - 1, 0)];
  } else if (button === "right" || button === "down") {
    menus.menuFocus = choices[Math.min(at + 1, choices.length - 1)];
  }
  return "handled";
}

/**
 * Presses pause-menu button `choice`, picking the new row's first choice,
 * or keeping the Fullscreen button picked.
 */
function pickChoice(
  menus: Menus,
  choice: MenuChoice,
  nowMs: number,
): MenuRequest | null {
  const started = choose(menus, choice, nowMs);
  // The Fullscreen button leaves the row as it was, so stays picked.
  if (choice !== "fullscreen") {
    menus.menuFocus = defaultChoice(menus.pause.confirming);
  }
  return started;
}

/** The choice a controller starts on: No while confirming, for safety. */
function defaultChoice(confirming: boolean): MenuChoice {
  return confirming ? "goBack" : "newHero";
}

/** Whether `button` is one of the D-pad's directions. */
function isDirection(button: PadButton): boolean {
  return DIRECTIONS.some((direction) => direction === button);
}

/**
 * The open panel the controller acts on: the one opened last, if still
 * open, otherwise the first open one, or null with none open.
 */
export function currentPanel(menus: Menus): Panel | null {
  if (menus.lastOpened && panelOpen(menus, menus.lastOpened)) {
    return menus.lastOpened;
  }
  return PANELS.find((panel) => panelOpen(menus, panel)) ?? null;
}

/** Picks a pause-menu button, by key or by click. */
function choose(
  menus: Menus,
  choice: MenuChoice,
  nowMs: number,
): MenuRequest | null {
  const { pause } = menus;
  switch (choice) {
    case "newHero":
      pause.confirming = true;
      return null;
    case "goBack":
      pause.confirming = false;
      return null;
    case "fullscreen":
      return "fullscreen";
    case "confirm":
      if (!pause.confirming) return null;
      // Starts afresh with nothing open.
      togglePause(pause, nowMs);
      closePanels(menus);
      return "newHero";
  }
}
