import { describe, expect, it } from "vitest";
import { pressButton } from "./buttonPress";
import { createMenus } from "./menus";
import { combatArea } from "./sim/testAreas";
import { createWorld, type World } from "./sim/world";

/** A Town of one tile with the Hero's `start` on it. */
const town = {
  orientation: "orthogonal",
  width: 1,
  height: 1,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "floor", width: 1, height: 1, data: [1] },
    {
      type: "objectgroup",
      name: "objects",
      objects: [{ name: "start", type: "entry", point: true, x: 16, y: 16 }],
    },
  ],
};

/** A World whose Hero has `points` Attribute and Skill Points to spend. */
function worldWith(points: { attributePoints?: number; skillPoints?: number }) {
  const world = createWorld({ areas: { town }, seed: 1 });
  Object.assign(world.hero.progress, points);
  return world;
}

/** `world` with its Hero lying dead. */
function dead(world: World): World {
  world.death = { elapsed: 0 };
  return world;
}

describe("a press on Level Up", () => {
  it("opens the Hero panel and Skill Tree while there are points to spend", () => {
    const menus = createMenus();
    const world = worldWith({ attributePoints: 1, skillPoints: 1 });

    const orders = pressButton(menus, world, { type: "levelUp" });

    expect(orders).toEqual([]);
    expect(menus.heroPanelOpen).toBe(true);
    expect(menus.skillTreeOpen).toBe(true);
  });

  it("opens nothing while the Hero lies dead", () => {
    const menus = createMenus();
    const world = dead(worldWith({ attributePoints: 1, skillPoints: 1 }));

    pressButton(menus, world, { type: "levelUp" });

    expect(menus.heroPanelOpen).toBe(false);
    expect(menus.skillTreeOpen).toBe(false);
  });
});

describe("the Hero panel's + and −", () => {
  it("plan a Pending Attribute Point and take it back", () => {
    const menus = createMenus();
    const world = worldWith({ attributePoints: 1 });

    pressButton(menus, world, { type: "raise", attribute: "strength" });
    expect(menus.pendingPoints.strength).toBe(1);
    pressButton(menus, world, { type: "lower", attribute: "strength" });
    expect(menus.pendingPoints.strength).toBe(0);
  });

  it("plan no more points than the Hero has", () => {
    const menus = createMenus();
    const world = worldWith({ attributePoints: 1 });

    pressButton(menus, world, { type: "raise", attribute: "strength" });
    pressButton(menus, world, { type: "raise", attribute: "strength" });

    expect(menus.pendingPoints.strength).toBe(1);
  });

  it("plan nothing while the Hero lies dead", () => {
    const menus = createMenus();
    const world = dead(worldWith({ attributePoints: 1 }));

    pressButton(menus, world, { type: "raise", attribute: "strength" });

    expect(menus.pendingPoints.strength).toBe(0);
  });
});

describe("a press on Accept", () => {
  it("orders the Pending Attribute Points spent", () => {
    const menus = createMenus();
    const world = worldWith({ attributePoints: 1 });
    pressButton(menus, world, { type: "raise", attribute: "strength" });

    const orders = pressButton(menus, world, { type: "accept" });

    expect(orders).toEqual([
      {
        type: "SpendAttributePoints",
        points: { ...createMenus().pendingPoints, strength: 1 },
      },
    ]);
    expect(menus.pendingPoints.strength).toBe(0);
  });

  it("orders nothing while no points are pending", () => {
    const menus = createMenus();

    expect(pressButton(menus, worldWith({}), { type: "accept" })).toEqual([]);
  });
});

describe("a panel's ×", () => {
  it.each([
    ["hero", "heroPanelOpen"],
    ["inventory", "inventoryOpen"],
    ["skillTree", "skillTreeOpen"],
  ] as const)("shuts the %s panel", (panel, open) => {
    const menus = createMenus();
    menus[open] = true;

    const orders = pressButton(menus, worldWith({}), { type: "close", panel });

    expect(orders).toEqual([]);
    expect(menus[open]).toBe(false);
  });

  it("cancels the Hero panel's Pending Attribute Points", () => {
    const menus = createMenus();
    const world = worldWith({ attributePoints: 1 });
    menus.heroPanelOpen = true;
    pressButton(menus, world, { type: "raise", attribute: "strength" });

    pressButton(menus, world, { type: "close", panel: "hero" });

    expect(menus.pendingPoints.strength).toBe(0);
  });
});

describe("the Skill Tree's +", () => {
  it("orders a Skill Point spent on its Skill", () => {
    const menus = createMenus();
    const world = worldWith({ skillPoints: 1 });
    const skill = "golem" as const;

    const orders = pressButton(menus, world, { type: "learn", skill });

    expect(orders).toEqual([{ type: "SpendSkillPoint", skill }]);
  });
});

describe("a Branch tab", () => {
  it("opens its Branch, starting on Bone, and keeps it while the panel is shut and reopened", () => {
    const menus = createMenus();
    const world = worldWith({});
    const panelButton = { type: "panelButton", panel: "skillTree" } as const;

    expect(menus.skillTreeBranch).toBe("bone");
    pressButton(menus, world, panelButton);
    const orders = pressButton(menus, world, {
      type: "branchTab",
      branch: "curses",
    });
    expect(orders).toEqual([]);
    expect(menus.skillTreeBranch).toBe("curses");

    pressButton(menus, world, panelButton);
    expect(menus.skillTreeOpen).toBe(false);
    pressButton(menus, world, panelButton);
    expect(menus.skillTreeOpen).toBe(true);
    expect(menus.skillTreeBranch).toBe("curses");
  });
});

describe("a Panel button", () => {
  it("opens and shuts its panel", () => {
    const menus = createMenus();
    const world = worldWith({});
    const button = { type: "panelButton", panel: "inventory" } as const;

    pressButton(menus, world, button);
    expect(menus.inventoryOpen).toBe(true);
    pressButton(menus, world, button);
    expect(menus.inventoryOpen).toBe(false);
  });

  it("opens nothing while the Hero lies dead", () => {
    const menus = createMenus();
    const world = dead(worldWith({}));

    pressButton(menus, world, { type: "panelButton", panel: "inventory" });

    expect(menus.inventoryOpen).toBe(false);
  });
});

describe("a press between the buttons", () => {
  it("does nothing", () => {
    const menus = createMenus();

    expect(pressButton(menus, worldWith({}), null)).toEqual([]);
    expect(menus).toEqual(createMenus());
  });
});

describe("a press on the Town Portal button", () => {
  /** A World whose Hero stands in a Combat Area off Town. */
  function inCombatArea(): World {
    const cave = combatArea(town);
    return createWorld({
      areas: { town, cave },
      seed: 1,
      start: { area: "cave", entry: "start" },
    });
  }

  it("orders a Town Portal opened outside Town", () => {
    const menus = createMenus();

    const orders = pressButton(menus, inCombatArea(), { type: "townPortal" });

    expect(orders).toEqual([{ type: "OpenTownPortal" }]);
  });

  it("does nothing in Town", () => {
    const menus = createMenus();
    const world = createWorld({ areas: { town }, seed: 1 });

    expect(pressButton(menus, world, { type: "townPortal" })).toEqual([]);
  });

  it("does nothing while the Hero lies dead", () => {
    const menus = createMenus();

    const orders = pressButton(menus, dead(inCombatArea()), {
      type: "townPortal",
    });

    expect(orders).toEqual([]);
  });
});

describe("a press on the Mini Map", () => {
  it("opens the Map Overlay and orders nothing, so the Hero doesn't walk", () => {
    const menus = createMenus();
    const world = worldWith({});

    const orders = pressButton(menus, world, { type: "miniMap" });

    expect(menus.mapOpen).toBe(true);
    expect(orders).toEqual([]);
  });

  it("does nothing while the Hero lies dead", () => {
    const menus = createMenus();

    const orders = pressButton(menus, dead(worldWith({})), {
      type: "miniMap",
    });

    expect(menus.mapOpen).toBe(false);
    expect(orders).toEqual([]);
  });
});

describe("a press on a Quest button of the Dialogue panel", () => {
  it("orders the Quest accepted and keeps the panel open", () => {
    const menus = createMenus();
    menus.dialogueOpen = true;

    const orders = pressButton(menus, worldWith({}), {
      type: "acceptQuest",
      quest: "lost-wanderer",
    });

    expect(orders).toEqual([{ type: "AcceptQuest", quest: "lost-wanderer" }]);
    expect(menus.dialogueOpen).toBe(true);
  });

  it("orders the Quest handed in and keeps the panel open", () => {
    const menus = createMenus();
    menus.dialogueOpen = true;

    const orders = pressButton(menus, worldWith({}), {
      type: "handInQuest",
      quest: "lost-wanderer",
    });

    expect(orders).toEqual([{ type: "HandInQuest", quest: "lost-wanderer" }]);
    expect(menus.dialogueOpen).toBe(true);
  });

  it("orders nothing while the Hero lies dead", () => {
    const orders = pressButton(createMenus(), dead(worldWith({})), {
      type: "acceptQuest",
      quest: "lost-wanderer",
    });

    expect(orders).toEqual([]);
  });
});

describe("a press on the Smith's service buttons of the Dialogue panel", () => {
  it("opens his list at its first page, and More gear turns the page", () => {
    const menus = createMenus();
    menus.dialogueOpen = true;

    const orders = pressButton(menus, worldWith({}), { type: "smithService" });

    expect(orders).toEqual([]);
    expect(menus.dialoguePage).toBe(1);
    pressButton(menus, worldWith({}), { type: "smithMore" });
    expect(menus.dialoguePage).toBe(2);
    expect(menus.dialogueOpen).toBe(true);
  });

  it("orders the Item worked on, keeping the panel open", () => {
    const menus = createMenus();
    menus.dialogueOpen = true;

    const orders = pressButton(menus, worldWith({}), {
      type: "smithForge",
      item: 7,
    });

    expect(orders).toEqual([{ type: "SmithBonus", item: 7 }]);
    expect(menus.dialogueOpen).toBe(true);
  });

  it("orders nothing while the Hero lies dead", () => {
    const orders = pressButton(createMenus(), dead(worldWith({})), {
      type: "smithForge",
      item: 7,
    });

    expect(orders).toEqual([]);
  });
});

describe("a press on Trade in the Dialogue panel", () => {
  it("opens the Vendor panel in its place, for the same NPC", () => {
    const menus = createMenus();
    menus.dialogueOpen = true;
    menus.dialogueNpc = 2;

    const orders = pressButton(menus, worldWith({}), { type: "trade" });

    expect(orders).toEqual([]);
    expect(menus.vendorOpen).toBe(true);
    expect(menus.dialogueOpen).toBe(false);
    expect(menus.dialogueNpc).toBe(2);
  });

  it("shuts the Vendor panel from its ×", () => {
    const menus = createMenus();
    menus.vendorOpen = true;

    pressButton(menus, worldWith({}), {
      type: "close",
      panel: "vendor",
    });

    expect(menus.vendorOpen).toBe(false);
  });
});
