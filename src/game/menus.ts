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
  /** Which screen shows: the Loading Screen, the Start Screen, or play. */
  screen: Screen;
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

/**
 * The screen the game is on. The Loading Screen shows how many files have
 * `loaded` out of `total`, and whether loading has `failed`, which offers
 * Retry. The Start Screen offers Continue only when there is a Save
 * (`hasSave`), and New Hero, which asks to confirm while `confirming`. On
 * either, keys, panels, the map and the pause menu do nothing.
 */
export type Screen =
  | { type: "loading"; loaded: number; total: number; failed: boolean }
  | StartScreen
  | { type: "playing" };

/** The Start Screen's state. */
export type StartScreen = {
  type: "start";
  hasSave: boolean;
  confirming: boolean;
};

/** The Start Screen as loading ends, for a game that does or doesn't `hasSave`. */
export function startScreen(hasSave: boolean): StartScreen {
  return { type: "start", hasSave, confirming: false };
}

/** The Loading Screen as loading starts: nothing loaded yet. */
export function loadingScreen(): Screen {
  return { type: "loading", loaded: 0, total: 0, failed: false };
}

/** Whether the game is on its Loading Screen. */
export function isLoading(menus: Pick<Menus, "screen">): boolean {
  return menus.screen.type === "loading";
}

/** Notes that `progress` of the load is done. */
export function reportLoad(
  menus: Menus,
  progress: { loaded: number; total: number },
) {
  if (menus.screen.type !== "loading") return;
  menus.screen = { ...menus.screen, ...progress };
}

/** Notes that loading failed, which offers Retry. */
export function failLoad(menus: Menus) {
  if (menus.screen.type !== "loading") return;
  menus.screen = { ...menus.screen, failed: true };
}

/** Starts loading over, as Retry asks, with an empty bar. */
export function startLoad(menus: Menus) {
  menus.screen = loadingScreen();
}

/**
 * Notes that loading is done: the Start Screen shows, unless `skipStart`
 * (a dev start link), which begins play. `hasSave` says whether the Start
 * Screen offers Continue.
 */
export function finishLoading(
  menus: Menus,
  { hasSave, skipStart }: { hasSave: boolean; skipStart: boolean },
) {
  menus.screen = skipStart ? { type: "playing" } : startScreen(hasSave);
}

/** Whether the game is playing, rather than on the Loading or Start Screen. */
export function isPlaying(menus: Pick<Menus, "screen">): boolean {
  return menus.screen.type === "playing";
}

/** The Retry button, the Loading Screen's one choice. */
export type LoadingChoice = "retry";

/**
 * A click on the Loading Screen, on its Retry button (`choice`) or, for
 * null, anywhere else. Asks for `"retry"` only once loading has failed.
 */
export function clickLoading(
  menus: Menus,
  choice: LoadingChoice | null,
): MenuRequest | null {
  const { screen } = menus;
  return !menus.rotateNotice &&
    screen.type === "loading" &&
    screen.failed &&
    choice === "retry"
    ? "retry"
    : null;
}

/** A count of Pending Attribute Points on each Attribute. */
export type PendingPoints = Record<Attribute, number>;

export function createMenus(screen: Screen = { type: "playing" }): Menus {
  return {
    screen,
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
 * The buttons of the Start Screen and the pause menu. On the Start Screen,
 * New Hero asks to confirm one, and then `confirm` starts it while `goBack`
 * returns to the choices. The pause menu has Quit to Start Screen. The
 * Fullscreen button asks to go in or out of fullscreen.
 */
export type MenuChoice =
  | "continue"
  | "newHero"
  | "quit"
  | "confirm"
  | "goBack"
  | "fullscreen";

/** The Fullscreen button, the Rotate Notice's one choice. */
export type FullscreenChoice = Extract<MenuChoice, "fullscreen">;

/**
 * What the menus ask the game loop to carry out: continue with the Save's
 * Hero or start a New Hero (both from the Start Screen, which then gives
 * way to play), take the game in or out of fullscreen, load again after
 * a failed load, or quit from the pause menu back to the Start Screen.
 */
export type MenuRequest =
  | "continue"
  | "newHero"
  | "quit"
  | "fullscreen"
  | "retry";

/**
 * The pause menu's buttons in their row from left to right: Quit to Start
 * Screen, and the Fullscreen button where `fullscreen` says the browser
 * allows it.
 */
export function menuChoices(fullscreen: Fullscreen): MenuChoice[] {
  return fullscreen.available ? ["quit", "fullscreen"] : ["quit"];
}

/**
 * Goes back to the Start Screen after a `"quit"` request, which offers
 * Continue when the game `hasSave`.
 */
export function quitToStart(menus: Menus, hasSave: boolean) {
  menus.screen = startScreen(hasSave);
  menus.menuFocus = null;
}

/**
 * The Start Screen's buttons in their row from left to right: Continue
 * (with a Save), New Hero and the Fullscreen button where `fullscreen` says
 * the browser allows it, or Yes and No while confirming.
 */
export function startChoices(
  screen: StartScreen,
  fullscreen: Fullscreen,
): MenuChoice[] {
  if (screen.confirming) return ["confirm", "goBack"];
  return [
    ...(screen.hasSave ? (["continue"] as const) : []),
    "newHero",
    ...(fullscreen.available ? (["fullscreen"] as const) : []),
  ];
}

/**
 * A click on the Start Screen, on one of its buttons (`choice`) or, for
 * null, anywhere else, which does nothing; nor does anything under the Rotate
 * Notice. Returns `"continue"` or `"newHero"` once chosen, the screen then
 * giving way to play, and `"fullscreen"` on the Fullscreen button.
 */
export function clickStart(
  menus: Menus,
  choice: MenuChoice | null,
): MenuRequest | null {
  const { screen } = menus;
  if (menus.rotateNotice || screen.type !== "start" || choice === null) {
    return null;
  }
  menus.menuFocus = null;
  return pressStartChoice(menus, screen, choice);
}

/** Presses `choice` unless the Start Screen doesn't offer it. */
function pressStartChoice(
  menus: Menus,
  screen: StartScreen,
  choice: MenuChoice,
): MenuRequest | null {
  // A hidden Continue, or a Fullscreen button the browser doesn't allow.
  if (!startChoices(screen, menus.fullscreen).includes(choice)) return null;
  return chooseStart(menus, screen, choice);
}

/**
 * A controller button on the Start Screen, which takes them all. Focus
 * works as in the pause menu: none until the D-pad, the stick or A first
 * touches the screen, which picks the first button; then the D-pad moves
 * it, A presses the one picked, and B says No on the New Hero confirm.
 */
function pressStartPad(
  menus: Menus,
  screen: StartScreen,
  button: PadButton,
): MenuRequest | "handled" {
  const choices = startChoices(screen, menus.fullscreen);
  const picked = menus.menuFocus;
  const at = picked === null ? -1 : choices.indexOf(picked);
  if (button === "b") {
    if (screen.confirming) pressStartChoice(menus, screen, "goBack");
    menus.menuFocus = null;
  } else if (at === -1 && (button === "a" || isDirection(button))) {
    menus.menuFocus = choices[0];
  } else if (picked !== null && button === "a") {
    const asked = pressStartChoice(menus, screen, picked);
    // Asking to confirm, or going back, leaves a different row to pick in.
    if (asked !== "fullscreen") menus.menuFocus = null;
    return asked ?? "handled";
  } else if (button === "left" || button === "up") {
    menus.menuFocus = choices[Math.max(at - 1, 0)];
  } else if (button === "right" || button === "down") {
    menus.menuFocus = choices[Math.min(at + 1, choices.length - 1)];
  }
  return "handled";
}

/** Presses Start Screen button `choice`. */
function chooseStart(
  menus: Menus,
  screen: StartScreen,
  choice: MenuChoice,
): MenuRequest | null {
  switch (choice) {
    case "continue":
      menus.screen = { type: "playing" };
      return "continue";
    case "newHero":
      if (screen.hasSave) {
        screen.confirming = true;
        return null;
      }
      menus.screen = { type: "playing" };
      return "newHero";
    case "confirm":
      menus.screen = { type: "playing" };
      return "newHero";
    case "goBack":
      screen.confirming = false;
      return null;
    case "fullscreen":
      return "fullscreen";
    case "quit":
      // The pause menu's choice.
      return null;
  }
}

/** The key that opens and shuts the Map Overlay, as `pressKey` reads it. */
export const MAP_KEY = "Tab";

/**
 * A key pressed at real time `nowMs`, by `KeyboardEvent.key`. Esc opens and
 * closes the pause menu, and C the Hero panel, I the Inventory panel and T
 * the Skill Tree panel while the game runs; while `hero` lies dead, C, I and
 * T are taken but open nothing. Tab opens and closes the Map Overlay, but not
 * while `hero` lies dead. While the Rotate Notice shows, every key is taken
 * and does nothing. In the menu, Q quits to the Start Screen. Returns `"quit"`
 * for the caller to go back to it, `"handled"` for any other key the menus took,
 * and null for a key they leave to the game.
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
  if (menus.screen.type === "loading") {
    return menus.screen.failed && letter === "r" ? "retry" : "handled";
  }
  if (menus.screen.type === "start") {
    return pressStartKey(menus, menus.screen, key);
  }
  if (key === "Escape") {
    togglePause(pause, nowMs);
    menus.menuFocus = null;
    return "handled";
  }
  if (pause.paused) {
    if (letter === "q") return choose(menus, "quit", nowMs) ?? "handled";
    return "handled";
  }
  if (key === MAP_KEY) {
    toggleMap(menus, hero);
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
 * A key on the Start Screen, which takes them all: C continues and N asks
 * for a New Hero (confirmed by Y, and N or Esc go back), as in the pause menu.
 */
function pressStartKey(
  menus: Menus,
  screen: StartScreen,
  key: string,
): MenuRequest | "handled" {
  const letter = key.toLowerCase();
  let choice: MenuChoice | null = null;
  if (screen.confirming) {
    if (letter === "y") choice = "confirm";
    else if (letter === "n" || key === "Escape") choice = "goBack";
  } else if (letter === "c") choice = "continue";
  else if (letter === "n") choice = "newHero";
  return (choice && clickStart(menus, choice)) || "handled";
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

/** Opens the Map Overlay or shuts it, as Tab and LT do: not while `hero` lies dead. */
export function toggleMap(menus: Menus, hero: HeroState) {
  if (!hero.heroDead && isPlaying(menus)) menus.mapOpen = !menus.mapOpen;
}

/**
 * A click on the Mini Map, which opens the Map Overlay: nothing while `hero`
 * lies dead, nor under the Rotate Notice.
 */
export function clickMiniMap(menus: Menus, hero: HeroState) {
  if (hero.heroDead || menus.rotateNotice || !isPlaying(menus)) return;
  menus.mapOpen = true;
}

/** A tap on the open Map Overlay, away from any control, which closes it. */
export function tapMapOverlay(menus: Menus) {
  menus.mapOpen = false;
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
  if (hero.heroDead || menus.rotateNotice || !isPlaying(menus)) return;
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
  // Nothing runs before play, so there is nothing to pause.
  if (showing && isPlaying(menus) && !menus.pause.paused) {
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
  if (hero.heroDead || menus.rotateNotice || !isPlaying(menus)) return;
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
 * panels and the Map Overlay. Exits and Town Portals leave the Map Overlay
 * open.
 */
export function reactMenus(menus: Menus, events: readonly SimEvent[]) {
  for (const event of events) {
    if (event.type !== "HeroDied") continue;
    closePanels(menus);
    menus.mapOpen = false;
  }
}

/** Shuts the Hero, Inventory and Skill Tree panels. */
function closePanels(menus: Menus) {
  for (const panel of PANELS) shutPanel(menus, panel);
}

/**
 * A click at real time `nowMs` while paused, on one of the menu's buttons
 * or, for null, anywhere else, which resumes; nothing while the Rotate
 * Notice shows. Returns `"quit"` on Quit to Start Screen, for the caller
 * to go back to it, and `"fullscreen"` on the Fullscreen button, for the caller
 * to take the game in or out of fullscreen, the menu staying open.
 */
export function clickPaused(
  menus: Menus,
  choice: MenuChoice | null,
  nowMs: number,
): MenuRequest | null {
  if (menus.rotateNotice || !isPlaying(menus)) return null;
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
 * over. Menu opens and shuts the pause menu, picking Quit to Start Screen; in it, the
 * D-pad (or the stick) moves between its buttons, A presses the one picked,
 * and Menu or B resumes. While the game runs, View opens and shuts the Inventory panel,
 * LT the Map Overlay (not during Death, with a panel open or not), and
 * with a panel open, LB and RB move to the panel before or after it (in
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
  if (menus.screen.type === "loading") {
    return menus.screen.failed && button === "a" ? "retry" : "handled";
  }
  if (menus.screen.type === "start") {
    return pressStartPad(menus, menus.screen, button);
  }
  if (pause.paused) return pressPaused(menus, button, nowMs);
  if (button === "menu") {
    togglePause(pause, nowMs);
    menus.menuFocus = "quit";
    return "handled";
  }
  if (button === "view") {
    togglePanel(menus, "inventory", hero);
    return "handled";
  }
  if (button === "lt") {
    toggleMap(menus, hero);
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

/**
 * Opens the pause menu at real time `nowMs` for a controller that went while
 * it was played, so the Hero isn't killed while it's plugged back in. Before
 * play, on the Loading or Start Screen, there is nothing to pause.
 */
export function pauseForLostController(menus: Menus, nowMs: number) {
  if (!isPlaying(menus) || menus.pause.paused) return;
  togglePause(menus.pause, nowMs);
}

/** A controller button pressed in the pause menu, which takes them all. */
function pressPaused(
  menus: Menus,
  button: PadButton,
  nowMs: number,
): MenuRequest | "handled" {
  const { pause } = menus;
  const choices = menuChoices(menus.fullscreen);
  const picked = menus.menuFocus;
  const at = picked === null ? -1 : choices.indexOf(picked);
  if (button === "menu" || button === "b") {
    togglePause(pause, nowMs);
  } else if (at === -1 && (button === "a" || isDirection(button))) {
    menus.menuFocus = "quit";
  } else if (picked !== null && button === "a") {
    return choose(menus, picked, nowMs) ?? "handled";
  } else if (button === "left" || button === "up") {
    menus.menuFocus = choices[Math.max(at - 1, 0)];
  } else if (button === "right" || button === "down") {
    menus.menuFocus = choices[Math.min(at + 1, choices.length - 1)];
  }
  return "handled";
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
    case "continue":
      // The pause menu has no Continue: only the Start Screen does.
      return null;
    case "quit":
      // Leaves with nothing open and the game unpaused.
      togglePause(pause, nowMs);
      closePanels(menus);
      return "quit";
    case "fullscreen":
      return "fullscreen";
    case "newHero":
    case "confirm":
    case "goBack":
      // The Start Screen's choices.
      return null;
  }
}
