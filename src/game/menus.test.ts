import { describe, expect, it } from "vitest";
import {
  clickLevelUp,
  clickPaused,
  createMenus,
  pressKey,
  reactMenus,
} from "./menus";
import { togglePause } from "./pause";

describe("the keys", () => {
  it("open and close the pause menu with Esc", () => {
    const menus = createMenus();

    expect(pressKey(menus, "Escape", 1000)).toBe("handled");
    expect(menus.pause.paused).toBe(true);
    pressKey(menus, "Escape", 2000);
    expect(menus.pause.paused).toBe(false);
  });

  it("open and close the Hero panel with C while the game runs", () => {
    const menus = createMenus();

    expect(pressKey(menus, "c", 1000)).toBe("handled");
    expect(menus.heroPanelOpen).toBe(true);
    pressKey(menus, "C", 2000);
    expect(menus.heroPanelOpen).toBe(false);
  });

  it("open and close the Inventory panel with I while the game runs", () => {
    const menus = createMenus();

    expect(pressKey(menus, "i", 1000)).toBe("handled");
    expect(menus.inventoryOpen).toBe(true);
    pressKey(menus, "I", 2000);
    expect(menus.inventoryOpen).toBe(false);
  });

  it("keep the Hero and Inventory panels open together", () => {
    const menus = createMenus();

    pressKey(menus, "c", 1000);
    pressKey(menus, "i", 2000);

    expect(menus.heroPanelOpen).toBe(true);
    expect(menus.inventoryOpen).toBe(true);
    expect(menus.pause.paused).toBe(false);
  });

  it("leave the Inventory panel be while paused", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000);

    pressKey(menus, "i", 2000);

    expect(menus.inventoryOpen).toBe(false);
  });

  it("leave the Hero panel be while paused", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000);

    pressKey(menus, "c", 2000);

    expect(menus.heroPanelOpen).toBe(false);
  });

  it("leave any other key, N and Y included, to the game while it runs", () => {
    const menus = createMenus();

    expect(pressKey(menus, "n", 1000)).toBeNull();
    expect(pressKey(menus, "y", 1000)).toBeNull();
    expect(pressKey(menus, "x", 1000)).toBeNull();
    expect(menus.pause.paused).toBe(false);
    expect(menus.pause.confirming).toBe(false);
  });

  it("ask to confirm New Hero on N, and start one on Y, resuming", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000);

    expect(pressKey(menus, "N", 2000)).toBe("handled");
    expect(menus.pause.confirming).toBe(true);
    expect(pressKey(menus, "y", 3000)).toBe("newHero");
    expect(menus.pause.confirming).toBe(false);
    expect(menus.pause.paused).toBe(false);
  });

  it("close the Hero and Inventory panels for a New Hero", () => {
    const menus = createMenus();
    pressKey(menus, "c", 1000);
    pressKey(menus, "i", 1000);
    pressKey(menus, "Escape", 2000);
    pressKey(menus, "n", 3000);

    pressKey(menus, "y", 4000);

    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
  });

  it("take no Y for New Hero without the question first", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000);

    pressKey(menus, "y", 2000);

    expect(menus.pause.paused).toBe(true);
    expect(menus.pause.confirming).toBe(false);
  });

  it.each([
    "n",
    "Escape",
  ])("go back from the question to the menu on %s", (key) => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000);
    pressKey(menus, "n", 2000);

    expect(pressKey(menus, key, 3000)).toBe("handled");
    expect(menus.pause.confirming).toBe(false);
    expect(menus.pause.paused).toBe(true);
    expect(pressKey(menus, "y", 4000)).not.toBe("newHero");
  });

  it("forget the question when the menu is closed", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000);
    pressKey(menus, "n", 2000);

    togglePause(menus.pause, 3000);
    togglePause(menus.pause, 4000);

    expect(menus.pause.confirming).toBe(false);
    expect(pressKey(menus, "y", 5000)).not.toBe("newHero");
  });
});

describe("a click while paused", () => {
  it("asks to confirm New Hero on the New Hero button", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000);

    expect(clickPaused(menus, "newHero", 2000)).toBeNull();
    expect(menus.pause.confirming).toBe(true);
    expect(menus.pause.paused).toBe(true);
  });

  it("starts a New Hero on Yes, resuming", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000);
    clickPaused(menus, "newHero", 2000);

    expect(clickPaused(menus, "confirm", 3000)).toBe("newHero");
    expect(menus.pause.paused).toBe(false);
  });

  it("goes back from the question to the menu on No", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000);
    clickPaused(menus, "newHero", 2000);

    expect(clickPaused(menus, "goBack", 3000)).toBeNull();
    expect(menus.pause.confirming).toBe(false);
    expect(menus.pause.paused).toBe(true);
  });

  it.each([
    false,
    true,
  ])("resumes anywhere off the buttons, asking or not (%s)", (asking) => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000);
    if (asking) clickPaused(menus, "newHero", 2000);

    expect(clickPaused(menus, null, 3000)).toBeNull();
    expect(menus.pause.paused).toBe(false);
    expect(menus.pause.confirming).toBe(false);
  });
});

describe("a click on the Level Up button", () => {
  it("opens the Hero panel", () => {
    const menus = createMenus();

    clickLevelUp(menus);

    expect(menus.heroPanelOpen).toBe(true);
  });

  it("opens nothing while the Hero is dead", () => {
    const menus = createMenus();
    reactMenus(menus, [{ type: "HeroDied" }]);

    clickLevelUp(menus);

    expect(menus.heroPanelOpen).toBe(false);
  });
});

describe("the Hero's Death", () => {
  it("closes the Hero and Inventory panels", () => {
    const menus = createMenus();
    pressKey(menus, "c", 1000);
    pressKey(menus, "i", 1000);

    reactMenus(menus, [{ type: "HeroDied" }]);

    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
  });

  it.each([
    "c",
    "C",
    "i",
    "I",
  ])("leaves %s opening nothing, and takes it from the game", (key) => {
    const menus = createMenus();
    reactMenus(menus, [{ type: "HeroDied" }]);

    expect(pressKey(menus, key, 1000)).toBe("handled");
    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
  });

  it("keeps the panels shut back in Town, until C and I open them", () => {
    const menus = createMenus();
    pressKey(menus, "c", 1000);
    pressKey(menus, "i", 1000);
    reactMenus(menus, [{ type: "HeroDied" }]);

    reactMenus(menus, [{ type: "AreaChanged", area: "town", entry: "start" }]);

    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
    pressKey(menus, "c", 2000);
    pressKey(menus, "i", 2000);
    expect(menus.heroPanelOpen).toBe(true);
    expect(menus.inventoryOpen).toBe(true);
  });

  it("leaves any other key to the game, to go on to Town", () => {
    const menus = createMenus();
    reactMenus(menus, [{ type: "HeroDied" }]);

    expect(pressKey(menus, "x", 1000)).toBeNull();
    expect(pressKey(menus, " ", 1000)).toBeNull();
  });

  it("still opens and closes the pause menu with Esc", () => {
    const menus = createMenus();
    reactMenus(menus, [{ type: "HeroDied" }]);

    expect(pressKey(menus, "Escape", 1000)).toBe("handled");
    expect(menus.pause.paused).toBe(true);
    pressKey(menus, "Escape", 2000);
    expect(menus.pause.paused).toBe(false);
  });

  it("still starts a New Hero from the pause menu, whose panels open", () => {
    const menus = createMenus();
    reactMenus(menus, [{ type: "HeroDied" }]);
    pressKey(menus, "Escape", 1000);
    pressKey(menus, "n", 2000);

    expect(pressKey(menus, "y", 3000)).toBe("newHero");
    pressKey(menus, "c", 4000);
    pressKey(menus, "i", 4000);
    expect(menus.heroPanelOpen).toBe(true);
    expect(menus.inventoryOpen).toBe(true);
  });
});
