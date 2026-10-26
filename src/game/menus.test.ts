import { describe, expect, it } from "vitest";
import {
  acceptPendingPoints,
  addPendingPoint,
  clickClose,
  clickLevelUp,
  clickPanelButton,
  clickPaused,
  createMenus,
  fitMenus,
  panelOpen,
  pressKey,
  reactMenus,
  removePendingPoint,
  unplacedPoints,
} from "./menus";
import { gameTime, togglePause } from "./pause";

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

  it("are cancelled by a New Hero", () => {
    const menus = pendingOnStrength(2);
    pressKey(menus, "Escape", 2000, alive);
    pressKey(menus, "n", 3000, alive);

    expect(pressKey(menus, "y", 4000, alive)).toBe("newHero");
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
    expect(menus.pause.confirming).toBe(false);
    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.inventoryOpen).toBe(false);
    expect(menus.skillTreeOpen).toBe(false);
    fitMenus(menus, sideways, 3000);
    expect(menus.pause.paused).toBe(false);
  });

  it.each([
    null,
    "newHero",
  ] as const)("ignores a click, on the pause menu's %s or not", (choice) => {
    const menus = createMenus();
    pressKey(menus, "Escape", 500, alive);
    fitMenus(menus, upright, 1000);

    expect(clickPaused(menus, choice, 2000)).toBeNull();

    expect(menus.pause.paused).toBe(true);
    expect(menus.pause.confirming).toBe(false);
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
