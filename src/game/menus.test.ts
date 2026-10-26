import { describe, expect, it } from "vitest";
import {
  clickClose,
  clickLevelUp,
  clickPaused,
  createMenus,
  pressKey,
  reactMenus,
} from "./menus";
import { togglePause } from "./pause";

/** Whether the World has the Hero lying dead, as the menus are told. */
const alive = { heroDead: false };
const dead = { heroDead: true };

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

  it("leave any other key, N and Y included, to the game while it runs", () => {
    const menus = createMenus();

    expect(pressKey(menus, "n", 1000, alive)).toBeNull();
    expect(pressKey(menus, "y", 1000, alive)).toBeNull();
    expect(pressKey(menus, "x", 1000, alive)).toBeNull();
    expect(menus.pause.paused).toBe(false);
    expect(menus.pause.confirming).toBe(false);
  });

  it("ask to confirm New Hero on N, and start one on Y, resuming", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);

    expect(pressKey(menus, "N", 2000, alive)).toBe("handled");
    expect(menus.pause.confirming).toBe(true);
    expect(pressKey(menus, "y", 3000, alive)).toBe("newHero");
    expect(menus.pause.confirming).toBe(false);
    expect(menus.pause.paused).toBe(false);
  });

  it("close the Hero and Inventory panels for a New Hero", () => {
    const menus = createMenus();
    pressKey(menus, "c", 1000, alive);
    pressKey(menus, "i", 1000, alive);
    pressKey(menus, "Escape", 2000, alive);
    pressKey(menus, "n", 3000, alive);

    pressKey(menus, "y", 4000, alive);

    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
  });

  it("close the Skill Tree panel for a New Hero", () => {
    const menus = createMenus();
    pressKey(menus, "t", 1000, alive);
    pressKey(menus, "Escape", 2000, alive);
    pressKey(menus, "n", 3000, alive);

    pressKey(menus, "y", 4000, alive);

    expect(menus.skillTreeOpen).toBe(false);
  });

  it("take no Y for New Hero without the question first", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);

    pressKey(menus, "y", 2000, alive);

    expect(menus.pause.paused).toBe(true);
    expect(menus.pause.confirming).toBe(false);
  });

  it.each([
    "n",
    "Escape",
  ])("go back from the question to the menu on %s", (key) => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);
    pressKey(menus, "n", 2000, alive);

    expect(pressKey(menus, key, 3000, alive)).toBe("handled");
    expect(menus.pause.confirming).toBe(false);
    expect(menus.pause.paused).toBe(true);
    expect(pressKey(menus, "y", 4000, alive)).not.toBe("newHero");
  });

  it("forget the question when the menu is closed", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);
    pressKey(menus, "n", 2000, alive);

    togglePause(menus.pause, 3000);
    togglePause(menus.pause, 4000);

    expect(menus.pause.confirming).toBe(false);
    expect(pressKey(menus, "y", 5000, alive)).not.toBe("newHero");
  });
});

describe("a click while paused", () => {
  it("asks to confirm New Hero on the New Hero button", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);

    expect(clickPaused(menus, "newHero", 2000)).toBeNull();
    expect(menus.pause.confirming).toBe(true);
    expect(menus.pause.paused).toBe(true);
  });

  it("starts a New Hero on Yes, resuming", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);
    clickPaused(menus, "newHero", 2000);

    expect(clickPaused(menus, "confirm", 3000)).toBe("newHero");
    expect(menus.pause.paused).toBe(false);
  });

  it("goes back from the question to the menu on No", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, alive);
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
    pressKey(menus, "Escape", 1000, alive);
    if (asking) clickPaused(menus, "newHero", 2000);

    expect(clickPaused(menus, null, 3000)).toBeNull();
    expect(menus.pause.paused).toBe(false);
    expect(menus.pause.confirming).toBe(false);
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

  it("still starts a New Hero from the pause menu, whose panels open", () => {
    const menus = createMenus();
    pressKey(menus, "Escape", 1000, dead);
    pressKey(menus, "n", 2000, dead);

    expect(pressKey(menus, "y", 3000, dead)).toBe("newHero");
    // The New Hero's World starts with them alive.
    pressKey(menus, "c", 4000, alive);
    pressKey(menus, "i", 4000, alive);
    expect(menus.heroPanelOpen).toBe(true);
    expect(menus.inventoryOpen).toBe(true);
  });
});
