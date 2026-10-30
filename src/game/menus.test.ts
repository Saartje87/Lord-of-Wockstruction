import { describe, expect, it } from "vitest";
import { NO_FULLSCREEN } from "./fullscreen";
import {
  acceptPendingPoints,
  addPendingPoint,
  clickClose,
  clickLevelUp,
  clickLoading,
  clickMiniMap,
  clickPanelButton,
  clickPaused,
  clickStart,
  createMenus,
  failLoad,
  finishLoading,
  fitMenus,
  loadingScreen,
  type Menus,
  panelOpen,
  pauseForLostController,
  pressKey,
  pressPad,
  quitToStart,
  reactMenus,
  removePendingPoint,
  reportLoad,
  startChoices,
  startLoad,
  startScreen,
  tapMapOverlay,
  tapRotateNotice,
  toggleMap,
  unplacedPoints,
} from "./menus";
import { gameTime } from "./pause";

/** Whether the World has the Hero lying dead, as the menus are told. */
const alive = { heroDead: false };
const dead = { heroDead: true };

describe("the Map Overlay", () => {
  it("opens and shuts with Tab, which the menus take", () => {
    const menus = createMenus();

    expect(menus.mapOpen).toBe(false);
    expect(pressKey(menus, "Tab", 1000, alive)).toBe("handled");
    expect(menus.mapOpen).toBe(true);
    expect(pressKey(menus, "Tab", 2000, alive)).toBe("handled");
    expect(menus.mapOpen).toBe(false);
  });

  it("leaves the game running and the panels shut", () => {
    const menus = createMenus();

    pressKey(menus, "Tab", 1000, alive);

    expect(menus.pause.paused).toBe(false);
    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
    expect(menus.skillTreeOpen).toBe(false);
  });

  it("does nothing during Death", () => {
    const menus = createMenus();

    expect(pressKey(menus, "Tab", 1000, dead)).toBe("handled");
    expect(menus.mapOpen).toBe(false);
  });

  it("does nothing while the pause menu is open", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);

    pressKey(menus, "Tab", 2000, alive);

    expect(menus.mapOpen).toBe(false);
  });
});

describe("the Map Overlay on the controller", () => {
  it("opens and shuts with LT, which the menus take", () => {
    const menus = createMenus();

    expect(pressPad(menus, "lt", 1000, alive)).toBe("handled");
    expect(menus.mapOpen).toBe(true);
    expect(pressPad(menus, "lt", 2000, alive)).toBe("handled");
    expect(menus.mapOpen).toBe(false);
  });

  it("shares its state with Tab", () => {
    const menus = createMenus();

    pressKey(menus, "Tab", 1000, alive);
    pressPad(menus, "lt", 2000, alive);

    expect(menus.mapOpen).toBe(false);
  });

  it("does nothing during Death", () => {
    const menus = createMenus();

    pressPad(menus, "lt", 1000, dead);

    expect(menus.mapOpen).toBe(false);
  });

  it("does nothing while the pause menu is open", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);

    pressPad(menus, "lt", 2000, alive);

    expect(menus.mapOpen).toBe(false);
  });
});

describe("the Map Overlay through Death, Area changes and panels", () => {
  it("closes on the Hero's Death, and stays shut against Tab and LT", () => {
    const menus = createMenus();
    pressKey(menus, "Tab", 1000, alive);

    reactMenus(menus, [{ type: "HeroDied" }]);
    expect(menus.mapOpen).toBe(false);

    pressKey(menus, "Tab", 2000, dead);
    pressPad(menus, "lt", 3000, dead);
    expect(menus.mapOpen).toBe(false);
  });

  it("stays open through an Exit and a Town Portal", () => {
    const menus = createMenus();
    pressKey(menus, "Tab", 1000, alive);

    reactMenus(menus, [
      { type: "AreaChanged", area: "catacombs", entry: "start" },
    ]);
    reactMenus(menus, [
      { type: "TownPortalOpened", area: "catacombs", pos: { x: 1, y: 1 } },
    ]);
    reactMenus(menus, [{ type: "AreaChanged", area: "town", entry: "start" }]);

    expect(menus.mapOpen).toBe(true);
  });

  it("stays open while panels open and shut, by key, button and controller", () => {
    const menus = createMenus();
    pressKey(menus, "Tab", 1000, alive);

    pressKey(menus, "i", 2000, alive);
    expect(menus.mapOpen).toBe(true);
    pressPad(menus, "view", 3000, alive);
    expect(menus.mapOpen).toBe(true);
    clickPanelButton(menus, "hero", alive);
    expect(menus.mapOpen).toBe(true);
    pressPad(menus, "b", 4000, alive);
    expect(menus.mapOpen).toBe(true);
  });

  it("opens and shuts with a panel open", () => {
    const menus = createMenus();
    pressKey(menus, "i", 1000, alive);

    pressKey(menus, "Tab", 2000, alive);
    expect(menus.mapOpen).toBe(true);
    expect(menus.inventoryOpen).toBe(true);
    pressPad(menus, "lt", 3000, alive);
    expect(menus.mapOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(true);
  });
});

describe("the keys", () => {
  it("open and close the pause menu with Esc", () => {
    const menus = createMenus();

    expect(pressKey(menus, "Escape", 1000, alive)).toBe("handled");
    expect(menus.pause.paused).toBe(true);
    pressKey(menus, "Escape", 2000, alive);
    expect(menus.pause.paused).toBe(false);
  });

  it("open and close the Hero panel with C while the game runs", () => {
    const menus = createMenus();

    expect(pressKey(menus, "c", 1000, alive)).toBe("handled");
    expect(menus.heroPanelOpen).toBe(true);
    pressKey(menus, "C", 2000, alive);
    expect(menus.heroPanelOpen).toBe(false);
  });

  it("open and close the Inventory panel with I while the game runs", () => {
    const menus = createMenus();

    expect(pressKey(menus, "i", 1000, alive)).toBe("handled");
    expect(menus.inventoryOpen).toBe(true);
    pressKey(menus, "I", 2000, alive);
    expect(menus.inventoryOpen).toBe(false);
  });

  it("keep the Hero and Inventory panels open together", () => {
    const menus = createMenus();

    pressKey(menus, "c", 1000, alive);
    pressKey(menus, "i", 2000, alive);

    expect(menus.heroPanelOpen).toBe(true);
    expect(menus.inventoryOpen).toBe(true);
    expect(menus.pause.paused).toBe(false);
  });

  it("leave the Inventory panel be while paused", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);

    pressKey(menus, "i", 2000, alive);

    expect(menus.inventoryOpen).toBe(false);
  });

  it("open and close the Skill Tree panel with T while the game runs", () => {
    const menus = createMenus();

    expect(pressKey(menus, "t", 1000, alive)).toBe("handled");
    expect(menus.skillTreeOpen).toBe(true);
    pressKey(menus, "T", 2000, alive);
    expect(menus.skillTreeOpen).toBe(false);
  });

  // As in Diablo 2, they share the right of the screen.
  it("shut the Inventory panel when T opens the Skill Tree, and back", () => {
    const menus = createMenus();
    pressKey(menus, "i", 1000, alive);

    pressKey(menus, "t", 2000, alive);
    expect(menus.skillTreeOpen).toBe(true);
    expect(menus.inventoryOpen).toBe(false);

    pressKey(menus, "i", 3000, alive);
    expect(menus.inventoryOpen).toBe(true);
    expect(menus.skillTreeOpen).toBe(false);
  });

  it("keep the Hero and Skill Tree panels open together", () => {
    const menus = createMenus();

    pressKey(menus, "c", 1000, alive);
    pressKey(menus, "t", 2000, alive);

    expect(menus.heroPanelOpen).toBe(true);
    expect(menus.skillTreeOpen).toBe(true);
  });

  it("leave the Skill Tree panel be while paused", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);

    pressKey(menus, "t", 2000, alive);

    expect(menus.skillTreeOpen).toBe(false);
  });

  it("leave the Hero panel be while paused", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);

    pressKey(menus, "c", 2000, alive);

    expect(menus.heroPanelOpen).toBe(false);
  });

  it("leave any other key, N, Q and Y included, to the game while it runs", () => {
    const menus = createMenus();

    expect(pressKey(menus, "n", 1000, alive)).toBeNull();
    expect(pressKey(menus, "q", 1000, alive)).toBeNull();
    expect(pressKey(menus, "y", 1000, alive)).toBeNull();
    expect(pressKey(menus, "x", 1000, alive)).toBeNull();
    expect(menus.pause.paused).toBe(false);
  });

  it("quit to the Start Screen on Q with no confirm, resuming", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);

    expect(pressKey(menus, "Q", 2000, alive)).toBe("quit");
    expect(menus.pause.paused).toBe(false);
  });

  it("take N and Y in the pause menu for nothing: New Hero is on the Start Screen", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);

    expect(pressKey(menus, "n", 2000, alive)).toBe("handled");
    expect(pressKey(menus, "y", 3000, alive)).toBe("handled");
    expect(menus.pause.paused).toBe(true);
  });

  it("close the Hero, Inventory and Skill Tree panels for a quit", () => {
    const menus = createMenus();
    pressKey(menus, "c", 1000, alive);
    pressKey(menus, "i", 1000, alive);
    pressKey(menus, "t", 1000, alive);
    pressKey(menus, "Escape", 2000, alive);

    pressKey(menus, "q", 3000, alive);

    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
    expect(menus.skillTreeOpen).toBe(false);
  });
});

describe("a click while paused", () => {
  it("quits to the Start Screen on the Quit to Start Screen button, resuming", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);

    expect(clickPaused(menus, "quit", 2000)).toBe("quit");
    expect(menus.pause.paused).toBe(false);
  });

  it.each([
    "newHero",
    "confirm",
    "goBack",
  ] as const)("takes the Start Screen's %s button for nothing", (choice) => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);

    expect(clickPaused(menus, choice, 2000)).toBeNull();
    expect(menus.pause.paused).toBe(true);
  });

  it("resumes anywhere off the buttons", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);

    expect(clickPaused(menus, null, 3000)).toBeNull();
    expect(menus.pause.paused).toBe(false);
  });
});

describe("quitting to the Start Screen", () => {
  it("shows the Start Screen, with Continue for a Save", () => {
    const menus = createMenus();
    menus.screen = { type: "playing" };

    quitToStart(menus, true);

    expect(menus.screen).toEqual(startScreen(true));
  });

  it("shows the Start Screen without Continue when there is no Save", () => {
    const menus = createMenus();

    quitToStart(menus, false);

    expect(menus.screen).toEqual(startScreen(false));
  });

  it("leaves no controller Focus behind", () => {
    const menus = createMenus();
    pressPad(menus, "menu", 1000, alive);

    quitToStart(menus, true);

    expect(menus.menuFocus).toBeNull();
  });
});

describe("the Fullscreen button", () => {
  /** Menus paused by Esc where the browser allows fullscreen, at 1000. */
  function pausedWithFullscreen(on = false) {
    const menus = createMenus();
    menus.fullscreen = { available: true, on };
    pressKey(menus, "Escape", 1000, alive);
    return menus;
  }

  it("asks for fullscreen on a click or tap, leaving the menu open", () => {
    const menus = pausedWithFullscreen();

    expect(clickPaused(menus, "fullscreen", 2000)).toBe("fullscreen");
    expect(menus.pause.paused).toBe(true);
  });

  it("asks to leave fullscreen the same way while fullscreen", () => {
    const menus = pausedWithFullscreen(true);

    expect(clickPaused(menus, "fullscreen", 2000)).toBe("fullscreen");
    expect(menus.pause.paused).toBe(true);
  });

  it("is reached by the controller's focus, and A asks for fullscreen", () => {
    const menus = createMenus();
    menus.fullscreen = { available: true, on: false };
    pressPad(menus, "menu", 1000, alive);

    pressPad(menus, "right", 2000, alive);
    expect(menus.menuFocus).toBe("fullscreen");

    expect(pressPad(menus, "a", 3000, alive)).toBe("fullscreen");
    expect(menus.pause.paused).toBe(true);
    expect(menus.menuFocus).toBe("fullscreen");
  });

  it("can't be reached by the controller where the browser forbids it", () => {
    const menus = createMenus();
    pressPad(menus, "menu", 1000, alive);

    pressPad(menus, "right", 2000, alive);

    expect(menus.menuFocus).toBe("quit");
  });

  it("leaves Quit to Start Screen to the click", () => {
    const menus = pausedWithFullscreen();

    expect(clickPaused(menus, "quit", 2000)).toBe("quit");
    expect(menus.pause.paused).toBe(false);
  });

  it("leaves Quit to Start Screen to the controller, left of it", () => {
    const menus = createMenus();
    menus.fullscreen = { available: true, on: false };
    pressPad(menus, "menu", 1000, alive);
    pressPad(menus, "right", 2000, alive);

    pressPad(menus, "left", 3000, alive);

    expect(pressPad(menus, "a", 4000, alive)).toBe("quit");
    expect(menus.pause.paused).toBe(false);
  });

  it("does nothing while the Rotate Notice shows", () => {
    const menus = pausedWithFullscreen();
    fitMenus(menus, { compact: true, rotateNotice: "tooSmall" }, 2000);

    expect(clickPaused(menus, "fullscreen", 3000)).toBeNull();
    expect(pressPad(menus, "a", 3000, alive)).toBe("handled");
  });
});

describe("a click on the Level Up button", () => {
  it("opens the Hero panel with Attribute Points unspent", () => {
    const menus = createMenus();

    clickLevelUp(menus, { ...alive, attributePoints: 5, skillPoints: 0 });

    expect(menus.heroPanelOpen).toBe(true);
    expect(menus.skillTreeOpen).toBe(false);
  });

  it("opens the Skill Tree panel with Skill Points unspent", () => {
    const menus = createMenus();
    pressKey(menus, "i", 1000, alive);

    clickLevelUp(menus, { ...alive, attributePoints: 0, skillPoints: 1 });

    expect(menus.skillTreeOpen).toBe(true);
    expect(menus.inventoryOpen).toBe(false);
    expect(menus.heroPanelOpen).toBe(false);
  });

  it("opens both with both kinds of points unspent", () => {
    const menus = createMenus();

    clickLevelUp(menus, { ...alive, attributePoints: 5, skillPoints: 1 });

    expect(menus.heroPanelOpen).toBe(true);
    expect(menus.skillTreeOpen).toBe(true);
  });

  it("opens nothing while the Hero is dead", () => {
    const menus = createMenus();

    clickLevelUp(menus, { ...dead, attributePoints: 5, skillPoints: 1 });

    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.skillTreeOpen).toBe(false);
  });
});

describe("a click on a panel's ×", () => {
  it("shuts the Hero panel, as C does", () => {
    const menus = createMenus();
    pressKey(menus, "c", 1000, alive);
    pressKey(menus, "i", 1000, alive);

    clickClose(menus, "hero");

    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(true);
  });

  it("shuts the Inventory panel, as I does", () => {
    const menus = createMenus();
    pressKey(menus, "c", 1000, alive);
    pressKey(menus, "i", 1000, alive);

    clickClose(menus, "inventory");

    expect(menus.inventoryOpen).toBe(false);
    expect(menus.heroPanelOpen).toBe(true);
  });

  it("shuts the Skill Tree panel, as T does, leaving the Inventory shut", () => {
    const menus = createMenus();
    pressKey(menus, "c", 1000, alive);
    pressKey(menus, "t", 1000, alive);

    clickClose(menus, "skillTree");

    expect(menus.skillTreeOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
    expect(menus.heroPanelOpen).toBe(true);
  });

  it("leaves a shut panel shut, never opening it as its key would", () => {
    const menus = createMenus();

    clickClose(menus, "hero");
    clickClose(menus, "inventory");
    clickClose(menus, "skillTree");

    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
    expect(menus.skillTreeOpen).toBe(false);
  });
});

describe("a click on the Mini Map", () => {
  it("opens the Map Overlay", () => {
    const menus = createMenus();

    clickMiniMap(menus, alive);

    expect(menus.mapOpen).toBe(true);
  });

  it("does nothing while the Hero lies dead, as Tab does not", () => {
    const menus = createMenus();

    clickMiniMap(menus, { heroDead: true });

    expect(menus.mapOpen).toBe(false);
  });

  it("does nothing under the Rotate Notice", () => {
    const menus = createMenus();
    menus.rotateNotice = true;

    clickMiniMap(menus, alive);

    expect(menus.mapOpen).toBe(false);
  });
});

describe("toggling the Map Overlay", () => {
  it("opens and shuts it while the Hero lives", () => {
    const menus = createMenus();

    toggleMap(menus, alive);
    expect(menus.mapOpen).toBe(true);
    toggleMap(menus, alive);
    expect(menus.mapOpen).toBe(false);
  });

  it("does nothing while the Hero lies dead", () => {
    const menus = createMenus();

    toggleMap(menus, dead);

    expect(menus.mapOpen).toBe(false);
  });
});

describe("a tap on the open Map Overlay", () => {
  it("closes it", () => {
    const menus = { ...createMenus(), mapOpen: true };

    tapMapOverlay(menus);

    expect(menus.mapOpen).toBe(false);
  });

  it("leaves the panels as they are", () => {
    const menus = { ...createMenus(), mapOpen: true, inventoryOpen: true };

    tapMapOverlay(menus);

    expect(menus.inventoryOpen).toBe(true);
  });
});

describe("a click on a Panel button", () => {
  it("opens and shuts each panel, as its key does", () => {
    const menus = createMenus();

    clickPanelButton(menus, "hero", alive);
    expect(menus.heroPanelOpen).toBe(true);
    clickPanelButton(menus, "hero", alive);
    expect(menus.heroPanelOpen).toBe(false);

    clickPanelButton(menus, "inventory", alive);
    expect(menus.inventoryOpen).toBe(true);
    clickPanelButton(menus, "inventory", alive);
    expect(menus.inventoryOpen).toBe(false);

    clickPanelButton(menus, "skillTree", alive);
    expect(menus.skillTreeOpen).toBe(true);
    clickPanelButton(menus, "skillTree", alive);
    expect(menus.skillTreeOpen).toBe(false);
  });

  it("shuts the Skill Tree panel as the Inventory opens, and the other way round", () => {
    const menus = createMenus();

    clickPanelButton(menus, "skillTree", alive);
    clickPanelButton(menus, "inventory", alive);
    expect(menus.inventoryOpen).toBe(true);
    expect(menus.skillTreeOpen).toBe(false);

    clickPanelButton(menus, "skillTree", alive);
    expect(menus.skillTreeOpen).toBe(true);
    expect(menus.inventoryOpen).toBe(false);
  });

  it("leaves the Inventory or Skill Tree panel be with the Hero panel's", () => {
    const menus = createMenus();
    clickPanelButton(menus, "inventory", alive);

    clickPanelButton(menus, "hero", alive);
    expect(menus.heroPanelOpen).toBe(true);
    expect(menus.inventoryOpen).toBe(true);

    clickPanelButton(menus, "skillTree", alive);
    clickPanelButton(menus, "hero", alive);
    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.skillTreeOpen).toBe(true);
  });

  it("does nothing while the Hero lies dead", () => {
    const menus = createMenus();

    clickPanelButton(menus, "hero", dead);
    clickPanelButton(menus, "inventory", dead);
    clickPanelButton(menus, "skillTree", dead);

    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
    expect(menus.skillTreeOpen).toBe(false);
  });

  it("shuts a panel its key opened, and its key shuts one the button opened", () => {
    const menus = createMenus();

    pressKey(menus, "i", 1000, alive);
    clickPanelButton(menus, "inventory", alive);
    expect(menus.inventoryOpen).toBe(false);

    clickPanelButton(menus, "skillTree", alive);
    pressKey(menus, "t", 1000, alive);
    expect(menus.skillTreeOpen).toBe(false);

    clickPanelButton(menus, "hero", alive);
    pressKey(menus, "c", 1000, alive);
    expect(menus.heroPanelOpen).toBe(false);
  });

  it("cancels Pending Attribute Points as it shuts the Hero panel, as C does", () => {
    const menus = createMenus();
    clickPanelButton(menus, "hero", alive);
    addPendingPoint(menus, "strength", { heroDead: false, attributePoints: 2 });

    clickPanelButton(menus, "hero", alive);

    expect(unplacedPoints(menus, 2)).toBe(2);
  });
});

describe("the Hero's Death", () => {
  it("closes the Hero and Inventory panels", () => {
    const menus = createMenus();
    pressKey(menus, "c", 1000, alive);
    pressKey(menus, "i", 1000, alive);

    reactMenus(menus, [{ type: "HeroDied" }]);

    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
  });

  it("closes the Skill Tree panel", () => {
    const menus = createMenus();
    pressKey(menus, "t", 1000, alive);

    reactMenus(menus, [{ type: "HeroDied" }]);

    expect(menus.skillTreeOpen).toBe(false);
  });

  it.each([
    "c",
    "C",
    "i",
    "I",
    "t",
    "T",
  ])("leaves %s opening nothing, and takes it from the game", (key) => {
    const menus = createMenus();

    expect(pressKey(menus, key, 1000, dead)).toBe("handled");
    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
    expect(menus.skillTreeOpen).toBe(false);
  });

  it("keeps the panels shut back in Town, until C and I open them", () => {
    const menus = createMenus();
    pressKey(menus, "c", 1000, alive);
    pressKey(menus, "i", 1000, alive);
    reactMenus(menus, [{ type: "HeroDied" }]);

    reactMenus(menus, [{ type: "AreaChanged", area: "town", entry: "start" }]);

    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
    pressKey(menus, "c", 2000, alive);
    pressKey(menus, "i", 2000, alive);
    expect(menus.heroPanelOpen).toBe(true);
    expect(menus.inventoryOpen).toBe(true);
  });

  it("leaves any other key to the game, to go on to Town", () => {
    const menus = createMenus();

    expect(pressKey(menus, "x", 1000, dead)).toBeNull();
    expect(pressKey(menus, " ", 1000, dead)).toBeNull();
  });

  it("still opens and closes the pause menu with Esc", () => {
    const menus = createMenus();

    expect(pressKey(menus, "Escape", 1000, dead)).toBe("handled");
    expect(menus.pause.paused).toBe(true);
    pressKey(menus, "Escape", 2000, dead);
    expect(menus.pause.paused).toBe(false);
  });

  it("still quits from the pause menu", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, dead);

    expect(pressKey(menus, "q", 2000, dead)).toBe("quit");
  });
});

/** A living Hero with `attributePoints` unspent, as the menus are told. */
const unspent = (attributePoints: number) => ({
  heroDead: false,
  attributePoints,
});

/** The menus with the Hero panel open and `points` pending on Strength. */
function pendingOnStrength(points: number) {
  const menus = createMenus();
  pressKey(menus, "c", 1000, alive);
  for (let i = 0; i < points; i++) {
    addPendingPoint(menus, "strength", unspent(5));
  }
  return menus;
}

describe("Pending Attribute Points", () => {
  it("start at none", () => {
    const menus = createMenus();

    expect(menus.pendingPoints).toEqual({
      strength: 0,
      dexterity: 0,
      vitality: 0,
      energy: 0,
    });
    expect(unplacedPoints(menus, 5)).toBe(5);
  });

  it("are added by + one at a time, leaving fewer points to place", () => {
    const menus = createMenus();

    addPendingPoint(menus, "strength", unspent(5));
    addPendingPoint(menus, "strength", unspent(5));
    addPendingPoint(menus, "energy", unspent(5));

    expect(menus.pendingPoints).toMatchObject({ strength: 2, energy: 1 });
    expect(unplacedPoints(menus, 5)).toBe(2);
  });

  it("can't be added beyond the unspent points", () => {
    const menus = createMenus();

    for (let i = 0; i < 3; i++) addPendingPoint(menus, "vitality", unspent(2));

    expect(menus.pendingPoints.vitality).toBe(2);
    expect(unplacedPoints(menus, 2)).toBe(0);
  });

  it("can't be added while the Hero lies dead", () => {
    const menus = createMenus();

    addPendingPoint(menus, "strength", { heroDead: true, attributePoints: 5 });

    expect(menus.pendingPoints.strength).toBe(0);
  });

  it("are taken back off by −, leaving more points to place", () => {
    const menus = pendingOnStrength(2);

    removePendingPoint(menus, "strength");

    expect(menus.pendingPoints.strength).toBe(1);
    expect(unplacedPoints(menus, 5)).toBe(4);
  });

  it("can't be taken off an Attribute with none, below its accepted value", () => {
    const menus = pendingOnStrength(1);

    removePendingPoint(menus, "dexterity");
    removePendingPoint(menus, "strength");
    removePendingPoint(menus, "strength");

    expect(menus.pendingPoints).toMatchObject({ strength: 0, dexterity: 0 });
    expect(unplacedPoints(menus, 5)).toBe(5);
  });

  it("are spent all at once by Accept, in one order, and cleared", () => {
    const menus = pendingOnStrength(2);
    addPendingPoint(menus, "energy", unspent(5));

    expect(acceptPendingPoints(menus)).toEqual({
      type: "SpendAttributePoints",
      points: { strength: 2, dexterity: 0, vitality: 0, energy: 1 },
    });
    expect(menus.pendingPoints).toMatchObject({ strength: 0, energy: 0 });
  });

  it("make Accept order nothing while none are pending", () => {
    const menus = createMenus();

    expect(acceptPendingPoints(menus)).toBeNull();
  });

  it("leave more points to place once a Level is gained", () => {
    const menus = createMenus();
    for (let i = 0; i < 5; i++) addPendingPoint(menus, "strength", unspent(5));

    addPendingPoint(menus, "dexterity", unspent(10));

    expect(menus.pendingPoints).toMatchObject({ strength: 5, dexterity: 1 });
    expect(unplacedPoints(menus, 10)).toBe(4);
  });

  it("are cancelled as C shuts the Hero panel", () => {
    const menus = pendingOnStrength(2);

    pressKey(menus, "c", 2000, alive);

    expect(menus.pendingPoints.strength).toBe(0);
  });

  it("are cancelled as the × shuts the Hero panel", () => {
    const menus = pendingOnStrength(2);

    clickClose(menus, "hero");

    expect(menus.pendingPoints.strength).toBe(0);
  });

  it("are cancelled by the Hero's Death", () => {
    const menus = pendingOnStrength(2);

    reactMenus(menus, [{ type: "HeroDied" }]);

    expect(menus.pendingPoints.strength).toBe(0);
  });

  it("are cancelled by quitting to the Start Screen", () => {
    const menus = pendingOnStrength(2);
    pressKey(menus, "Escape", 2000, alive);

    expect(pressKey(menus, "q", 3000, alive)).toBe("quit");
    expect(menus.pendingPoints.strength).toBe(0);
  });

  it("stay as other panels open and shut, or the game pauses", () => {
    const menus = pendingOnStrength(2);

    pressKey(menus, "i", 2000, alive);
    pressKey(menus, "t", 2000, alive);
    clickClose(menus, "skillTree");
    pressKey(menus, "Escape", 3000, alive);
    pressKey(menus, "Escape", 4000, alive);

    expect(menus.heroPanelOpen).toBe(true);
    expect(menus.pendingPoints.strength).toBe(2);
  });
});

describe("the Compact Layout", () => {
  /** Menus fitted to a short screen, such as a phone held sideways. */
  function compactMenus() {
    const menus = createMenus();
    fitMenus(menus, { compact: true, rotateNotice: null }, 1000);
    return menus;
  }

  /** Which of the three panels are open, by name. */
  function openPanels(menus: ReturnType<typeof createMenus>) {
    return (["hero", "inventory", "skillTree"] as const).filter((panel) =>
      panelOpen(menus, panel),
    );
  }

  it("shuts the Inventory or Skill Tree panel as C opens the Hero panel, and the other way round", () => {
    const menus = compactMenus();

    pressKey(menus, "i", 1000, alive);
    pressKey(menus, "c", 1000, alive);
    expect(openPanels(menus)).toEqual(["hero"]);

    pressKey(menus, "t", 1000, alive);
    expect(openPanels(menus)).toEqual(["skillTree"]);

    pressKey(menus, "c", 1000, alive);
    pressKey(menus, "i", 1000, alive);
    expect(openPanels(menus)).toEqual(["inventory"]);
  });

  it("shuts the open panel as a Panel button opens another", () => {
    const menus = compactMenus();

    clickPanelButton(menus, "hero", alive);
    clickPanelButton(menus, "inventory", alive);
    expect(openPanels(menus)).toEqual(["inventory"]);

    clickPanelButton(menus, "hero", alive);
    expect(openPanels(menus)).toEqual(["hero"]);

    clickPanelButton(menus, "skillTree", alive);
    expect(openPanels(menus)).toEqual(["skillTree"]);
  });

  it("still shuts a panel on its × or its own Panel button, opening none", () => {
    const menus = compactMenus();

    clickPanelButton(menus, "hero", alive);
    clickClose(menus, "hero");
    expect(openPanels(menus)).toEqual([]);

    clickPanelButton(menus, "inventory", alive);
    clickPanelButton(menus, "inventory", alive);
    expect(openPanels(menus)).toEqual([]);
  });

  it("cancels Pending Attribute Points as another panel shuts the Hero panel", () => {
    const menus = compactMenus();
    pressKey(menus, "c", 1000, alive);
    addPendingPoint(menus, "strength", { heroDead: false, attributePoints: 2 });

    pressKey(menus, "i", 1000, alive);

    expect(unplacedPoints(menus, 2)).toBe(2);
  });

  it("opens only the Hero panel on Level Up with both kinds of points unspent", () => {
    const menus = compactMenus();
    pressKey(menus, "i", 1000, alive);

    clickLevelUp(menus, { ...alive, attributePoints: 5, skillPoints: 1 });

    expect(openPanels(menus)).toEqual(["hero"]);
  });

  it("opens the Skill Tree panel alone on Level Up with Skill Points unspent", () => {
    const menus = compactMenus();
    pressKey(menus, "c", 1000, alive);

    clickLevelUp(menus, { ...alive, attributePoints: 0, skillPoints: 1 });

    expect(openPanels(menus)).toEqual(["skillTree"]);
  });

  it("keeps the panel opened last as the screen turns short, shutting the other", () => {
    const menus = createMenus();
    pressKey(menus, "i", 1000, alive);
    pressKey(menus, "c", 1000, alive);
    addPendingPoint(menus, "strength", { heroDead: false, attributePoints: 2 });

    fitMenus(menus, { compact: true, rotateNotice: null }, 1000);
    expect(openPanels(menus)).toEqual(["hero"]);
    expect(unplacedPoints(menus, 2)).toBe(1);

    fitMenus(menus, { compact: false, rotateNotice: null }, 1000);
    pressKey(menus, "t", 1000, alive);
    fitMenus(menus, { compact: true, rotateNotice: null }, 1000);
    expect(openPanels(menus)).toEqual(["skillTree"]);
    expect(unplacedPoints(menus, 2)).toBe(2);
  });

  it("keeps the panel opened last after another was shut in between", () => {
    const menus = createMenus();
    pressKey(menus, "c", 1000, alive);
    pressKey(menus, "i", 1000, alive);
    pressKey(menus, "t", 1000, alive);
    pressKey(menus, "t", 1000, alive);
    pressKey(menus, "i", 1000, alive);

    fitMenus(menus, { compact: true, rotateNotice: null }, 1000);

    expect(openPanels(menus)).toEqual(["inventory"]);
  });

  it("lets both panels open together again once the screen is tall enough", () => {
    const menus = compactMenus();

    fitMenus(menus, { compact: false, rotateNotice: null }, 1000);
    pressKey(menus, "c", 1000, alive);
    pressKey(menus, "i", 1000, alive);

    expect(openPanels(menus)).toEqual(["hero", "inventory"]);
  });
});

describe("the Rotate Notice", () => {
  const upright = { compact: false, rotateNotice: "turn" } as const;
  const sideways = { compact: true, rotateNotice: null } as const;

  it("stops game time while it shows", () => {
    const menus = createMenus();

    fitMenus(menus, upright, 1000);

    expect(gameTime(menus.pause, 1000)).toBe(1000);
    expect(gameTime(menus.pause, 61_000)).toBe(1000);
  });

  it("stays paused while it keeps showing, frame after frame", () => {
    const menus = createMenus();

    fitMenus(menus, upright, 1000);
    fitMenus(menus, upright, 1016);
    fitMenus(menus, upright, 1032);

    expect(menus.pause.paused).toBe(true);
    expect(gameTime(menus.pause, 5000)).toBe(1000);
  });

  it("resumes the World where it stopped as it goes away", () => {
    const menus = createMenus();
    fitMenus(menus, upright, 1000);

    fitMenus(menus, sideways, 61_000);

    expect(menus.pause.paused).toBe(false);
    expect(gameTime(menus.pause, 61_016)).toBe(1016);
  });

  it("leaves the pause menu open as it goes away, if it was open before", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 500, alive);
    fitMenus(menus, upright, 1000);

    fitMenus(menus, sideways, 2000);

    expect(menus.pause.paused).toBe(true);
    pressKey(menus, "Escape", 3000, alive);
    expect(gameTime(menus.pause, 3000)).toBe(500);
  });

  it.each([
    "Escape",
    "c",
    "i",
    "t",
    "n",
    "q",
    "1",
  ])("takes the %s key but does nothing with it", (key) => {
    const menus = createMenus();
    fitMenus(menus, upright, 1000);

    expect(pressKey(menus, key, 2000, alive)).toBe("handled");

    expect(menus.pause.paused).toBe(true);
    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
    expect(menus.skillTreeOpen).toBe(false);
    fitMenus(menus, sideways, 3000);
    expect(menus.pause.paused).toBe(false);
  });

  it.each([
    null,
    "quit",
  ] as const)("ignores a click, on the pause menu's %s or not", (choice) => {
    const menus = createMenus();
    pressKey(menus, "Escape", 500, alive);
    fitMenus(menus, upright, 1000);

    expect(clickPaused(menus, choice, 2000)).toBeNull();

    expect(menus.pause.paused).toBe(true);
  });

  describe("on a touch screen too small, where fullscreen is allowed", () => {
    const tooSmall = { compact: true, rotateNotice: "tooSmall" } as const;
    /** Menus with the notice showing, paused by it at 1000. */
    const showing = () => {
      const menus = createMenus();
      menus.fullscreen = { available: true, on: false };
      fitMenus(menus, tooSmall, 1000);
      return menus;
    };

    it("asks for fullscreen on a tap on its Fullscreen button", () => {
      const menus = showing();

      expect(tapRotateNotice(menus, "fullscreen")).toBe("fullscreen");

      expect(menus.pause.paused).toBe(true);
    });

    it("takes a tap anywhere else and does nothing", () => {
      const menus = showing();

      expect(tapRotateNotice(menus, null)).toBeNull();

      expect(menus.pause.paused).toBe(true);
      fitMenus(menus, sideways, 3000);
      expect(menus.pause.paused).toBe(false);
    });

    it("still takes every other input for nothing", () => {
      const menus = showing();

      expect(clickPaused(menus, "fullscreen", 2000)).toBeNull();
      expect(clickPaused(menus, null, 2000)).toBeNull();
      expect(pressKey(menus, "Escape", 2000, alive)).toBe("handled");
      expect(pressPad(menus, "a", 2000, alive)).toBe("handled");
      expect(pressPad(menus, "menu", 2000, alive)).toBe("handled");

      expect(menus.pause.paused).toBe(true);
    });

    it("asks for nothing where the browser doesn't allow fullscreen", () => {
      const menus = showing();
      menus.fullscreen = { available: false, on: false };

      expect(tapRotateNotice(menus, "fullscreen")).toBeNull();
    });

    it("asks for nothing once the notice has gone", () => {
      const menus = showing();
      fitMenus(menus, sideways, 2000);

      expect(tapRotateNotice(menus, "fullscreen")).toBeNull();
    });

    it("resumes the World it paused once fullscreen gives room", () => {
      const menus = showing();
      tapRotateNotice(menus, "fullscreen");
      menus.fullscreen = { available: true, on: true };

      fitMenus(menus, sideways, 61_000);

      expect(menus.pause.paused).toBe(false);
      expect(gameTime(menus.pause, 61_016)).toBe(1016);
    });

    it("leaves the pause menu open once fullscreen gives room, if it was open before", () => {
      const menus = createMenus();
      menus.fullscreen = { available: true, on: false };
      pressKey(menus, "Escape", 500, alive);
      fitMenus(menus, tooSmall, 1000);
      tapRotateNotice(menus, "fullscreen");

      fitMenus(menus, sideways, 2000);

      expect(menus.pause.paused).toBe(true);
    });
  });

  it("opens no panel from a Panel button or the Level Up button", () => {
    const menus = createMenus();
    fitMenus(menus, upright, 1000);

    clickPanelButton(menus, "inventory", alive);
    clickLevelUp(menus, {
      heroDead: false,
      attributePoints: 5,
      skillPoints: 1,
    });

    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
    expect(menus.skillTreeOpen).toBe(false);
  });
});

describe("the controller", () => {
  /** Which of the three panels are open, by name. */
  function openPanels(menus: Menus) {
    return (["hero", "inventory", "skillTree"] as const).filter((panel) =>
      panelOpen(menus, panel),
    );
  }

  /** Menus with the pause menu opened by Menu, at real time 1000. */
  function pausedByPad() {
    const menus = createMenus();
    pressPad(menus, "menu", 1000, alive);
    return menus;
  }

  describe("Menu", () => {
    it("opens the pause menu with Quit to Start Screen picked, and shuts it", () => {
      const menus = createMenus();

      expect(pressPad(menus, "menu", 1000, alive)).toBe("handled");
      expect(menus.pause.paused).toBe(true);
      expect(menus.menuFocus).toBe("quit");
      pressPad(menus, "menu", 2000, alive);
      expect(menus.pause.paused).toBe(false);
      expect(gameTime(menus.pause, 2000)).toBe(1000);
    });

    it("opens the pause menu during Death", () => {
      const menus = createMenus();

      pressPad(menus, "menu", 1000, dead);

      expect(menus.pause.paused).toBe(true);
    });
  });

  describe("in the pause menu", () => {
    it("A on Quit to Start Screen quits at once, with no confirm", () => {
      const menus = pausedByPad();

      expect(pressPad(menus, "a", 2000, alive)).toBe("quit");
      expect(menus.pause.paused).toBe(false);
    });

    it("B resumes", () => {
      const menus = pausedByPad();

      pressPad(menus, "b", 2000, alive);

      expect(menus.pause.paused).toBe(false);
    });

    it("stays on the last choice when pushed past it", () => {
      const menus = pausedByPad();

      pressPad(menus, "right", 3000, alive);
      pressPad(menus, "down", 3000, alive);

      expect(menus.menuFocus).toBe("quit");
    });

    it("picks nothing until a button is pressed, when opened by Esc", () => {
      const menus = createMenus();
      pressKey(menus, "Escape", 1000, alive);
      expect(menus.menuFocus).toBeNull();

      pressPad(menus, "a", 2000, alive);

      expect(menus.menuFocus).toBe("quit");
      expect(menus.pause.paused).toBe(true);
    });

    it("picks Quit to Start Screen on the first push, when opened by Esc", () => {
      const menus = createMenus();
      pressKey(menus, "Escape", 1000, alive);

      pressPad(menus, "right", 2000, alive);

      expect(menus.menuFocus).toBe("quit");
    });

    it.each([
      "view",
      "lb",
      "rb",
      "x",
    ] as const)("takes %s but does nothing with it", (button) => {
      const menus = pausedByPad();

      expect(pressPad(menus, button, 2000, alive)).toBe("handled");

      expect(menus.pause.paused).toBe(true);
      expect(openPanels(menus)).toEqual([]);
    });
  });

  describe("View", () => {
    it("opens and shuts the Inventory panel", () => {
      const menus = createMenus();

      expect(pressPad(menus, "view", 1000, alive)).toBe("handled");
      expect(openPanels(menus)).toEqual(["inventory"]);
      pressPad(menus, "view", 2000, alive);
      expect(openPanels(menus)).toEqual([]);
    });

    it("opens nothing during Death", () => {
      const menus = createMenus();

      pressPad(menus, "view", 1000, dead);

      expect(openPanels(menus)).toEqual([]);
    });
  });

  describe("with a panel open", () => {
    it("RB moves on to the next panel, round to the first", () => {
      const menus = createMenus();
      pressKey(menus, "c", 1000, alive);

      expect(pressPad(menus, "rb", 1000, alive)).toBe("handled");
      expect(openPanels(menus)).toEqual(["inventory"]);
      pressPad(menus, "rb", 1000, alive);
      expect(openPanels(menus)).toEqual(["skillTree"]);
      pressPad(menus, "rb", 1000, alive);
      expect(openPanels(menus)).toEqual(["hero"]);
    });

    it("LB moves back to the panel before, round to the last", () => {
      const menus = createMenus();
      pressKey(menus, "c", 1000, alive);

      expect(pressPad(menus, "lb", 1000, alive)).toBe("handled");
      expect(openPanels(menus)).toEqual(["skillTree"]);
      pressPad(menus, "lb", 1000, alive);
      expect(openPanels(menus)).toEqual(["inventory"]);
    });

    it("moves on from the panel opened last, leaving the Hero panel beside it", () => {
      const menus = createMenus();
      pressKey(menus, "c", 1000, alive);
      pressKey(menus, "i", 1000, alive);

      pressPad(menus, "rb", 1000, alive);

      expect(openPanels(menus)).toEqual(["hero", "skillTree"]);
    });

    it("cancels Pending Attribute Points on moving off the Hero panel", () => {
      const menus = createMenus();
      pressKey(menus, "c", 1000, alive);
      addPendingPoint(menus, "strength", {
        heroDead: false,
        attributePoints: 5,
      });

      pressPad(menus, "rb", 1000, alive);

      expect(unplacedPoints(menus, 5)).toBe(5);
    });

    it("keeps to one panel in the Compact Layout", () => {
      const menus = createMenus();
      fitMenus(menus, { compact: true, rotateNotice: null }, 1000);
      pressKey(menus, "i", 1000, alive);

      pressPad(menus, "lb", 1000, alive);

      expect(openPanels(menus)).toEqual(["hero"]);
    });

    it("B shuts it", () => {
      const menus = createMenus();
      pressKey(menus, "t", 1000, alive);

      expect(pressPad(menus, "b", 1000, alive)).toBe("handled");

      expect(openPanels(menus)).toEqual([]);
    });

    it("B shuts the panel opened last first", () => {
      const menus = createMenus();
      pressKey(menus, "i", 1000, alive);
      pressKey(menus, "c", 1000, alive);

      pressPad(menus, "b", 1000, alive);
      expect(openPanels(menus)).toEqual(["inventory"]);
      pressPad(menus, "b", 1000, alive);
      expect(openPanels(menus)).toEqual([]);
    });
  });

  it.each([
    "lb",
    "rb",
    "b",
    "a",
    "x",
    "left",
  ] as const)("leaves %s to the game with no panel open", (button) => {
    const menus = createMenus();

    expect(pressPad(menus, button, 1000, alive)).toBeNull();

    expect(openPanels(menus)).toEqual([]);
  });

  it.each([
    "menu",
    "view",
    "a",
    "rb",
  ] as const)("takes %s while the Rotate Notice shows, and does nothing", (button) => {
    const menus = createMenus();
    pressKey(menus, "c", 500, alive);
    fitMenus(menus, { compact: false, rotateNotice: "turn" }, 1000);

    expect(pressPad(menus, button, 2000, alive)).toBe("handled");

    expect(openPanels(menus)).toEqual(["hero"]);
    fitMenus(menus, { compact: false, rotateNotice: null }, 3000);
    expect(menus.pause.paused).toBe(false);
  });
});

describe("the Loading Screen", () => {
  const loadingMenus = () => createMenus(loadingScreen());

  it("starts empty, not failed", () => {
    expect(loadingMenus().screen).toEqual({
      type: "loading",
      loaded: 0,
      total: 0,
      failed: false,
    });
  });

  it("follows the load's progress", () => {
    const menus = loadingMenus();

    reportLoad(menus, { loaded: 3, total: 10 });

    expect(menus.screen).toMatchObject({ loaded: 3, total: 10 });
  });

  it("gives way to play when loading is done", () => {
    const menus = loadingMenus();

    finishLoading(menus, { hasSave: true, skipStart: true });

    expect(menus.screen).toEqual({ type: "playing" });
  });

  it("does nothing for keys, panels, the map and the pause menu", () => {
    const menus = loadingMenus();

    for (const key of ["Escape", "c", "i", "t", "Tab", "n", "y", "p"]) {
      expect(pressKey(menus, key, 1000, alive)).toBe("handled");
    }
    clickPanelButton(menus, "inventory", alive);
    clickMiniMap(menus, alive);
    toggleMap(menus, alive);
    clickLevelUp(menus, {
      ...alive,
      attributePoints: 5,
      skillPoints: 1,
    });

    expect(menus.pause.paused).toBe(false);
    expect(menus.mapOpen).toBe(false);
    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
    expect(menus.skillTreeOpen).toBe(false);
  });

  it("does nothing for the controller either", () => {
    const menus = loadingMenus();

    for (const button of ["menu", "view", "lt", "a", "b"] as const) {
      expect(pressPad(menus, button, 1000, alive)).toBe("handled");
    }

    expect(menus.pause.paused).toBe(false);
    expect(menus.mapOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
  });

  it("asks for no Retry while loading goes on", () => {
    const menus = loadingMenus();

    expect(pressKey(menus, "r", 1000, alive)).toBe("handled");
    expect(pressPad(menus, "a", 1000, alive)).toBe("handled");
    expect(clickLoading(menus, "retry")).toBeNull();
  });

  describe("after a failed load", () => {
    const failedMenus = () => {
      const menus = loadingMenus();
      reportLoad(menus, { loaded: 4, total: 10 });
      failLoad(menus);
      return menus;
    };

    it("says so, keeping the progress", () => {
      expect(failedMenus().screen).toMatchObject({
        type: "loading",
        loaded: 4,
        total: 10,
        failed: true,
      });
    });

    it("asks for Retry by a click, R or the controller's A", () => {
      expect(clickLoading(failedMenus(), "retry")).toBe("retry");
      expect(pressKey(failedMenus(), "r", 1000, alive)).toBe("retry");
      expect(pressPad(failedMenus(), "a", 1000, alive)).toBe("retry");
    });

    it("takes a click elsewhere for nothing", () => {
      expect(clickLoading(failedMenus(), null)).toBeNull();
    });

    it("still does nothing for other keys", () => {
      const menus = failedMenus();

      expect(pressKey(menus, "Escape", 1000, alive)).toBe("handled");
      expect(pressKey(menus, "c", 1000, alive)).toBe("handled");
      expect(menus.heroPanelOpen).toBe(false);
      expect(menus.pause.paused).toBe(false);
    });

    it("loads again from the start of the bar when told to", () => {
      const menus = failedMenus();

      startLoad(menus);

      expect(menus.screen).toEqual({
        type: "loading",
        loaded: 0,
        total: 0,
        failed: false,
      });
      expect(pressKey(menus, "r", 1000, alive)).toBe("handled");
    });
  });
});

describe("the Start Screen", () => {
  const fullscreenOk = { available: true, on: false };
  const startMenus = (hasSave: boolean) => {
    const menus = createMenus(loadingScreen());
    finishLoading(menus, { hasSave, skipStart: false });
    return menus;
  };

  it("follows loading, with the choice not yet confirming", () => {
    expect(startMenus(true).screen).toEqual({
      type: "start",
      hasSave: true,
      confirming: false,
    });
    expect(startScreen(false)).toEqual({
      type: "start",
      hasSave: false,
      confirming: false,
    });
  });

  it("is skipped by a dev start, going straight to play", () => {
    const menus = createMenus(loadingScreen());

    finishLoading(menus, { hasSave: true, skipStart: true });

    expect(menus.screen).toEqual({ type: "playing" });
  });

  it("offers Continue, New Hero and Fullscreen with a Save", () => {
    expect(startChoices(startScreen(true), fullscreenOk)).toEqual([
      "continue",
      "newHero",
      "fullscreen",
    ]);
  });

  it("hides Continue without a Save, and Fullscreen where not allowed", () => {
    expect(startChoices(startScreen(false), fullscreenOk)).toEqual([
      "newHero",
      "fullscreen",
    ]);
    expect(startChoices(startScreen(true), NO_FULLSCREEN)).toEqual([
      "continue",
      "newHero",
    ]);
  });

  it("offers Yes and No while confirming", () => {
    const menus = startMenus(true);

    pressKey(menus, "n", 1000, alive);

    expect(
      startChoices(
        menus.screen as ReturnType<typeof startScreen>,
        fullscreenOk,
      ),
    ).toEqual(["confirm", "goBack"]);
  });

  it("continues by C or a click, going into play", () => {
    const byKey = startMenus(true);
    const byClick = startMenus(true);

    expect(pressKey(byKey, "c", 1000, alive)).toBe("continue");
    expect(clickStart(byClick, "continue")).toBe("continue");

    expect(byKey.screen).toEqual({ type: "playing" });
    expect(byClick.screen).toEqual({ type: "playing" });
  });

  it("has no Continue without a Save", () => {
    const menus = startMenus(false);

    expect(pressKey(menus, "c", 1000, alive)).toBe("handled");
    expect(clickStart(menus, "continue")).toBeNull();
    expect(menus.screen.type).toBe("start");
  });

  it("asks to confirm a New Hero when it would replace a Save", () => {
    for (const press of [
      (m: Menus) => pressKey(m, "n", 1000, alive),
      (m: Menus) => clickStart(m, "newHero"),
    ]) {
      const menus = startMenus(true);

      press(menus);
      expect(menus.screen).toMatchObject({ type: "start", confirming: true });
    }
  });

  it("starts a New Hero at once without a Save", () => {
    const byKey = startMenus(false);
    const byClick = startMenus(false);

    expect(pressKey(byKey, "n", 1000, alive)).toBe("newHero");
    expect(clickStart(byClick, "newHero")).toBe("newHero");

    expect(byKey.screen).toEqual({ type: "playing" });
    expect(byClick.screen).toEqual({ type: "playing" });
  });

  describe("confirming a New Hero", () => {
    const confirming = () => {
      const menus = startMenus(true);
      pressKey(menus, "n", 1000, alive);
      return menus;
    };

    it("starts it on Y or Yes", () => {
      const byKey = confirming();
      const byClick = confirming();

      expect(pressKey(byKey, "y", 1000, alive)).toBe("newHero");
      expect(clickStart(byClick, "confirm")).toBe("newHero");

      expect(byKey.screen).toEqual({ type: "playing" });
      expect(byClick.screen).toEqual({ type: "playing" });
    });

    it("goes back to the choices on N, Esc or No", () => {
      for (const back of [
        (m: Menus) => pressKey(m, "n", 1000, alive),
        (m: Menus) => pressKey(m, "Escape", 1000, alive),
        (m: Menus) => clickStart(m, "goBack"),
      ]) {
        const menus = confirming();

        back(menus);

        expect(menus.screen).toEqual({
          type: "start",
          hasSave: true,
          confirming: false,
        });
      }
    });

    it("does not take C for Continue", () => {
      const menus = confirming();

      expect(pressKey(menus, "c", 1000, alive)).toBe("handled");
      expect(menus.screen).toMatchObject({ confirming: true });
    });
  });

  it("does nothing for Esc, the panel, map and pause keys", () => {
    const menus = startMenus(true);

    for (const key of ["Escape", "i", "t", "Tab", "p", "q", "1"]) {
      expect(pressKey(menus, key, 1000, alive)).toBe("handled");
    }
    clickPanelButton(menus, "inventory", alive);
    clickMiniMap(menus, alive);
    toggleMap(menus, alive);

    expect(menus.pause.paused).toBe(false);
    expect(menus.mapOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
    expect(menus.screen.type).toBe("start");
  });

  it("asks for fullscreen from its button, staying put", () => {
    const menus = startMenus(true);
    menus.fullscreen = fullscreenOk;

    expect(clickStart(menus, "fullscreen")).toBe("fullscreen");
    expect(menus.screen.type).toBe("start");
  });

  it("has no Fullscreen button where the browser doesn't allow it", () => {
    expect(clickStart(startMenus(true), "fullscreen")).toBeNull();
  });

  it("takes a click elsewhere for nothing", () => {
    const menus = startMenus(true);

    expect(clickStart(menus, null)).toBeNull();
    expect(menus.screen.type).toBe("start");
  });

  it("takes every key under the Rotate Notice", () => {
    const menus = startMenus(true);
    fitMenus(menus, { compact: true, rotateNotice: "turn" }, 1000);

    expect(pressKey(menus, "c", 1000, alive)).toBe("handled");
    expect(clickStart(menus, "continue")).toBeNull();
    expect(menus.screen.type).toBe("start");
  });

  describe("with a controller", () => {
    const withFullscreen = (hasSave: boolean) => {
      const menus = startMenus(hasSave);
      menus.fullscreen = fullscreenOk;
      return menus;
    };

    it("starts with Focus on nothing, A picking the first button without pressing it", () => {
      const menus = withFullscreen(true);
      expect(menus.menuFocus).toBeNull();

      expect(pressPad(menus, "a", 1000, alive)).toBe("handled");

      expect(menus.menuFocus).toBe("continue");
      expect(menus.screen.type).toBe("start");
    });

    it("moves Focus along the row with the D-pad, stopping at the ends", () => {
      const menus = withFullscreen(true);

      pressPad(menus, "right", 1000, alive);
      expect(menus.menuFocus).toBe("continue");
      pressPad(menus, "right", 1000, alive);
      expect(menus.menuFocus).toBe("newHero");
      pressPad(menus, "down", 1000, alive);
      expect(menus.menuFocus).toBe("fullscreen");
      pressPad(menus, "right", 1000, alive);
      expect(menus.menuFocus).toBe("fullscreen");
      pressPad(menus, "left", 1000, alive);
      pressPad(menus, "up", 1000, alive);
      pressPad(menus, "left", 1000, alive);
      expect(menus.menuFocus).toBe("continue");
    });

    it("A presses Continue", () => {
      const menus = withFullscreen(true);
      pressPad(menus, "left", 1000, alive);

      expect(pressPad(menus, "a", 1000, alive)).toBe("continue");
      expect(menus.screen).toEqual({ type: "playing" });
    });

    it("A starts a New Hero at once without a Save", () => {
      const menus = withFullscreen(false);
      pressPad(menus, "a", 1000, alive);

      expect(pressPad(menus, "a", 1000, alive)).toBe("newHero");
    });

    it("A on New Hero with a Save asks to confirm, with Focus cleared", () => {
      const menus = withFullscreen(true);
      pressPad(menus, "right", 1000, alive);
      pressPad(menus, "right", 1000, alive);

      expect(pressPad(menus, "a", 1000, alive)).toBe("handled");

      expect(menus.screen).toMatchObject({ confirming: true });
      expect(menus.menuFocus).toBeNull();
    });

    it("moves between Yes and No, A on Yes starting the New Hero", () => {
      const menus = withFullscreen(true);
      menus.screen = { ...startScreen(true), confirming: true };

      pressPad(menus, "right", 1000, alive);
      expect(menus.menuFocus).toBe("goBack");
      pressPad(menus, "left", 1000, alive);
      expect(menus.menuFocus).toBe("confirm");

      expect(pressPad(menus, "a", 1000, alive)).toBe("newHero");
    });

    it("first Focus on the confirm lands on No, so a stray A doesn't wipe the Save", () => {
      const menus = withFullscreen(true);
      menus.screen = { ...startScreen(true), confirming: true };

      pressPad(menus, "a", 1000, alive);

      expect(menus.menuFocus).toBe("goBack");
      expect(menus.screen).toMatchObject({ confirming: true });
    });

    it("B says No on the confirm, from the start of it", () => {
      const menus = withFullscreen(true);
      menus.screen = { ...startScreen(true), confirming: true };

      expect(pressPad(menus, "b", 1000, alive)).toBe("handled");

      expect(menus.screen).toEqual(startScreen(true));
      expect(menus.menuFocus).toBeNull();
    });

    it("B does nothing on the choices", () => {
      const menus = withFullscreen(true);

      expect(pressPad(menus, "b", 1000, alive)).toBe("handled");

      expect(menus.screen).toEqual(startScreen(true));
    });

    it("A on the Fullscreen button asks for it, keeping Focus there", () => {
      const menus = withFullscreen(false);
      pressPad(menus, "right", 1000, alive);
      pressPad(menus, "right", 1000, alive);

      expect(pressPad(menus, "a", 1000, alive)).toBe("fullscreen");
      expect(menus.menuFocus).toBe("fullscreen");
    });

    it("loses Focus to a click", () => {
      const menus = withFullscreen(true);
      pressPad(menus, "right", 1000, alive);

      clickStart(menus, "fullscreen");

      expect(menus.menuFocus).toBeNull();
    });

    it("starts with no Focus when back from play", () => {
      const menus = startMenus(true);
      menus.menuFocus = "newHero";

      quitToStart(menus, true);

      expect(menus.menuFocus).toBeNull();
    });
  });

  describe("when the controller disconnects", () => {
    it("opens nothing on the Start Screen", () => {
      const menus = startMenus(true);

      pauseForLostController(menus, 1000);

      expect(menus.pause.paused).toBe(false);
      expect(menus.screen).toEqual(startScreen(true));
    });

    it("opens nothing on a failed Loading Screen", () => {
      const menus = createMenus(loadingScreen());
      failLoad(menus);

      pauseForLostController(menus, 1000);

      expect(menus.pause.paused).toBe(false);
    });

    it("opens the pause menu in play, once", () => {
      const menus = createMenus();

      pauseForLostController(menus, 1000);
      pauseForLostController(menus, 2000);

      expect(menus.pause.paused).toBe(true);
      expect(gameTime(menus.pause, 3000)).toBe(1000);
    });
  });

  describe("under the Rotate Notice", () => {
    it("pauses nothing, and takes every key, click, tap and button", () => {
      const menus = startMenus(true);
      menus.fullscreen = fullscreenOk;

      fitMenus(menus, { compact: false, rotateNotice: "turn" }, 1000);

      expect(menus.rotateNotice).toBe(true);
      expect(menus.pause.paused).toBe(false);
      expect(pressKey(menus, "c", 1000, alive)).toBe("handled");
      expect(pressPad(menus, "a", 1000, alive)).toBe("handled");
      expect(clickStart(menus, "newHero")).toBeNull();
      expect(menus.screen).toEqual(startScreen(true));
      expect(menus.menuFocus).toBeNull();
    });

    it("lets the Fullscreen button of a too-small screen through", () => {
      const menus = startMenus(true);
      menus.fullscreen = fullscreenOk;
      fitMenus(menus, { compact: true, rotateNotice: "tooSmall" }, 1000);

      expect(tapRotateNotice(menus, "fullscreen")).toBe("fullscreen");
    });

    it("shows the Start Screen as it was once turned back, still not paused", () => {
      const menus = startMenus(true);
      pressKey(menus, "n", 500, alive);
      fitMenus(menus, { compact: false, rotateNotice: "turn" }, 1000);

      fitMenus(menus, { compact: true, rotateNotice: null }, 2000);

      expect(menus.rotateNotice).toBe(false);
      expect(menus.pause.paused).toBe(false);
      expect(menus.screen).toMatchObject({ type: "start", confirming: true });
    });

    it("covers a failed Loading Screen too, taking Retry's key, button and tap", () => {
      const menus = createMenus(loadingScreen());
      failLoad(menus);

      fitMenus(menus, { compact: false, rotateNotice: "turn" }, 1000);

      expect(menus.pause.paused).toBe(false);
      expect(pressKey(menus, "r", 1000, alive)).toBe("handled");
      expect(pressPad(menus, "a", 1000, alive)).toBe("handled");
      expect(clickLoading(menus, "retry")).toBeNull();

      fitMenus(menus, { compact: true, rotateNotice: null }, 2000);

      expect(clickLoading(menus, "retry")).toBe("retry");
      expect(menus.screen).toMatchObject({ type: "loading", failed: true });
    });
  });

  it("opens no pause menu for the controller", () => {
    const menus = startMenus(true);

    for (const button of ["menu", "view", "lt", "b"] as const) {
      expect(pressPad(menus, button, 1000, alive)).toBe("handled");
    }

    expect(menus.pause.paused).toBe(false);
    expect(menus.screen.type).toBe("start");
  });
});
