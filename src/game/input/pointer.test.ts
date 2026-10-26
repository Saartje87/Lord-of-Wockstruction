import { describe, expect, it } from "vitest";
import type { Vec } from "../sim/vec";
import {
  cancel,
  createPointerInput,
  move,
  poll,
  press,
  pressRight,
  release,
  takeRightClick,
} from "./pointer";

// Treat canvas pixels as tile units, so tests can speak in tiles, with no
// Monster or panel anywhere.
const asTiles = {
  toTile: (screen: Vec) => screen,
  monsterAt: () => null,
  groundLabelAt: () => null,
  groundItemAt: () => null,
  panelAt: () => null,
};

/** Like `asTiles`, with Monster 7 covering the tile (5, 5). */
const withMonster = {
  ...asTiles,
  monsterAt: (screen: Vec) =>
    Math.floor(screen.x) === 5 && Math.floor(screen.y) === 5 ? 7 : null,
};

describe("pointer input", () => {
  it("orders a walk to the centre of the clicked tile", () => {
    const input = createPointerInput();

    press(input, { x: 3.2, y: 4.9 });
    const { orders, click } = poll(input, 0, asTiles);

    expect(orders).toEqual([{ type: "MoveTo", target: { x: 3.5, y: 4.5 } }]);
    expect(click).toEqual({ x: 3.5, y: 4.5 });
  });

  it("re-targets the cursor every 120 ms while held", () => {
    const input = createPointerInput();
    press(input, { x: 1, y: 1 });
    poll(input, 1000, asTiles);

    move(input, { x: 2, y: 1 });
    expect(poll(input, 1119, asTiles).orders).toEqual([]);
    const held = poll(input, 1120, asTiles);
    expect(held.orders).toEqual([
      { type: "MoveTo", target: { x: 2.5, y: 1.5 } },
    ]);
    expect(held.click).toBeNull();

    release(input);
    move(input, { x: 3, y: 1 });
    expect(poll(input, 1300, asTiles).orders).toEqual([]);
  });

  it("still orders a walk for a click released within one frame", () => {
    const input = createPointerInput();

    press(input, { x: 3, y: 4 });
    release(input);

    expect(poll(input, 0, asTiles).orders).toEqual([
      { type: "MoveTo", target: { x: 3.5, y: 4.5 } },
    ]);
    expect(poll(input, 500, asTiles).orders).toEqual([]);
  });

  // A touch fires down, up and leave before the next frame.
  it("orders a walk for a tap whose pointer has already left", () => {
    const input = createPointerInput();

    press(input, { x: 3, y: 4 });
    release(input);
    move(input, null);

    expect(poll(input, 0, asTiles).orders).toEqual([
      { type: "MoveTo", target: { x: 3.5, y: 4.5 } },
    ]);
  });

  // The click that closes the pause menu.
  it("orders nothing for a cancelled click, even while still held", () => {
    const input = createPointerInput();

    press(input, { x: 3, y: 4 });
    cancel(input);

    expect(poll(input, 0, asTiles)).toEqual({
      orders: [],
      click: null,
      panel: null,
    });
    expect(poll(input, 500, asTiles).orders).toEqual([]);
  });
});

describe("pointer input on Monsters", () => {
  it("orders an Attack on a clicked Monster, with no click marker", () => {
    const input = createPointerInput();

    press(input, { x: 5.2, y: 5.7 });
    const { orders, click } = poll(input, 0, withMonster);

    expect(orders).toEqual([{ type: "Attack", monster: 7 }]);
    expect(click).toBeNull();
  });

  it("swings in place at the exact cursor on Shift + click, even on a Monster", () => {
    const input = createPointerInput();

    press(input, { x: 5.2, y: 5.7 }, { shift: true });
    const { orders, click } = poll(input, 0, withMonster);

    expect(orders).toEqual([{ type: "SwingAt", target: { x: 5.2, y: 5.7 } }]);
    expect(click).toBeNull();
  });

  it("keeps swinging towards the cursor while Shift + click is held", () => {
    const input = createPointerInput();
    press(input, { x: 2, y: 2 }, { shift: true });
    poll(input, 0, asTiles);

    move(input, { x: 3.3, y: 2 });

    expect(poll(input, 120, asTiles).orders).toEqual([
      { type: "SwingAt", target: { x: 3.3, y: 2 } },
    ]);
  });

  it("keeps attacking the held Monster, even once the cursor leaves it", () => {
    const input = createPointerInput();
    press(input, { x: 5.5, y: 5.5 });
    poll(input, 0, withMonster);

    expect(poll(input, 120, withMonster).orders).toEqual([
      { type: "Attack", monster: 7 },
    ]);
    move(input, { x: 1, y: 1 });
    expect(poll(input, 240, withMonster).orders).toEqual([
      { type: "Attack", monster: 7 },
    ]);
  });

  it("switches from steering to attacking when the cursor passes a Monster", () => {
    const input = createPointerInput();
    press(input, { x: 3, y: 5 });
    poll(input, 0, withMonster);

    move(input, { x: 5.5, y: 5.5 });
    expect(poll(input, 120, withMonster).orders).toEqual([
      { type: "Attack", monster: 7 },
    ]);
    move(input, { x: 7, y: 5 });
    expect(poll(input, 240, withMonster).orders).toEqual([
      { type: "Attack", monster: 7 },
    ]);
  });

  it("catches the cursor passing a Monster between two re-targets", () => {
    const input = createPointerInput();
    press(input, { x: 3, y: 5 });
    poll(input, 0, withMonster);

    move(input, { x: 5.5, y: 5.5 });
    expect(poll(input, 16, withMonster).orders).toEqual([
      { type: "Attack", monster: 7 },
    ]);
    move(input, { x: 7, y: 5 });
    expect(poll(input, 32, withMonster).orders).toEqual([]);
  });
});

/** Like `withMonster`, with Ground Item 3's label over the same tile. */
const withGroundItem = {
  ...withMonster,
  groundLabelAt: (screen: Vec) =>
    Math.floor(screen.x) === 5 && Math.floor(screen.y) === 5 ? 3 : null,
};

describe("pointer input on Ground Items", () => {
  it("picks up a clicked Ground Item, over a Monster, with no marker", () => {
    const input = createPointerInput();

    press(input, { x: 5.2, y: 5.7 });
    const { orders, click } = poll(input, 0, withGroundItem);

    expect(orders).toEqual([{ type: "PickUp", groundItem: 3 }]);
    expect(click).toBeNull();
  });

  it("orders nothing more while the click is held", () => {
    const input = createPointerInput();
    press(input, { x: 5.5, y: 5.5 });
    poll(input, 0, withGroundItem);

    expect(poll(input, 120, withGroundItem).orders).toEqual([]);
    move(input, { x: 8, y: 8 });
    expect(poll(input, 240, withGroundItem).orders).toEqual([]);
  });

  it("swings in place on Shift + click, even on a Ground Item", () => {
    const input = createPointerInput();

    press(input, { x: 5.2, y: 5.7 }, { shift: true });

    expect(poll(input, 0, withGroundItem).orders).toEqual([
      { type: "SwingAt", target: { x: 5.2, y: 5.7 } },
    ]);
  });
});

/**
 * Like `withMonster`, with Ground Item 4 lying on the floor over the tiles
 * (5, 5) and (6, 5), its label elsewhere.
 */
const withLyingItem = {
  ...withMonster,
  groundItemAt: (screen: Vec) =>
    Math.floor(screen.y) === 5 && [5, 6].includes(Math.floor(screen.x))
      ? 4
      : null,
};

describe("pointer input on a Ground Item's body", () => {
  it("picks up the Ground Item clicked on the floor, with no marker", () => {
    const input = createPointerInput();

    press(input, { x: 6.5, y: 5.5 });
    const { orders, click } = poll(input, 0, withLyingItem);

    expect(orders).toEqual([{ type: "PickUp", groundItem: 4 }]);
    expect(click).toBeNull();
  });

  it("attacks a Monster standing over it instead", () => {
    const input = createPointerInput();

    press(input, { x: 5.5, y: 5.5 });

    expect(poll(input, 0, withLyingItem).orders).toEqual([
      { type: "Attack", monster: 7 },
    ]);
  });

  it("orders nothing more while the click is held", () => {
    const input = createPointerInput();
    press(input, { x: 6.5, y: 5.5 });
    poll(input, 0, withLyingItem);

    move(input, { x: 8, y: 8 });
    expect(poll(input, 120, withLyingItem).orders).toEqual([]);
  });

  it("swings in place on Shift + click on it", () => {
    const input = createPointerInput();

    press(input, { x: 6.5, y: 5.5 }, { shift: true });

    expect(poll(input, 0, withLyingItem).orders).toEqual([
      { type: "SwingAt", target: { x: 6.5, y: 5.5 } },
    ]);
  });
});

/** Like `withMonster`, with a panel drawn over everything left of x = 4. */
const withPanel = {
  ...withMonster,
  panelAt: (screen: Vec) => (screen.x < 4 ? "the panel" : null),
};

describe("pointer input on a panel", () => {
  it("hands back what a click on it hit, ordering nothing", () => {
    const input = createPointerInput();

    press(input, { x: 2, y: 5 });

    expect(poll(input, 0, withPanel)).toEqual({
      orders: [],
      click: null,
      panel: "the panel",
    });
  });

  it("orders nothing for a Shift + click on it", () => {
    const input = createPointerInput();

    press(input, { x: 2, y: 5 }, { shift: true });

    expect(poll(input, 0, withPanel).orders).toEqual([]);
  });

  it("orders nothing while a click on it is held, even off it", () => {
    const input = createPointerInput();
    press(input, { x: 2, y: 5 });
    poll(input, 0, withPanel);

    move(input, { x: 5.5, y: 5.5 });
    expect(poll(input, 120, withPanel).orders).toEqual([]);
    move(input, { x: 8, y: 8 });
    expect(poll(input, 240, withPanel).orders).toEqual([]);
  });

  it("doesn't steer onto it while held from the floor", () => {
    const input = createPointerInput();
    press(input, { x: 6, y: 6 });
    poll(input, 0, withPanel);

    move(input, { x: 2, y: 5 });
    expect(poll(input, 120, withPanel).orders).toEqual([]);
    move(input, { x: 7, y: 6 });
    expect(poll(input, 240, withPanel).orders).toEqual([
      { type: "MoveTo", target: { x: 7.5, y: 6.5 } },
    ]);
  });
});

describe("right-clicks", () => {
  /** Like `asTiles`, with a panel left of x = 1. */
  const panelOnLeft = {
    ...asTiles,
    panelAt: (screen: Vec) => (screen.x < 1 ? "panel" : null),
  };

  it("in the World cast the right-click slot's Skill at the cursor, once", () => {
    const input = createPointerInput();
    pressRight(input, { x: 2.3, y: 5.6 });

    expect(poll(input, 0, panelOnLeft)).toEqual({
      orders: [{ type: "Cast", slot: "right", target: { x: 2.3, y: 5.6 } }],
      click: null,
      panel: null,
    });
    expect(poll(input, 16, panelOnLeft).orders).toEqual([]);
    expect(takeRightClick(input)).toBeNull();
  });

  it("cast alongside a left-click's order in the same frame", () => {
    const input = createPointerInput();
    press(input, { x: 3, y: 3 });
    pressRight(input, { x: 2, y: 5 });

    expect(poll(input, 0, panelOnLeft).orders).toEqual([
      { type: "MoveTo", target: { x: 3.5, y: 3.5 } },
      { type: "Cast", slot: "right", target: { x: 2, y: 5 } },
    ]);
  });

  it("on a panel are handed back once, ordering nothing", () => {
    const input = createPointerInput();
    pressRight(input, { x: 0.5, y: 5 });

    expect(poll(input, 0, panelOnLeft)).toEqual({
      orders: [],
      click: null,
      panel: null,
    });
    expect(takeRightClick(input)).toEqual({ x: 0.5, y: 5 });
    expect(takeRightClick(input)).toBeNull();
  });

  it("are forgotten by a cancel", () => {
    const input = createPointerInput();
    pressRight(input, { x: 2, y: 5 });
    cancel(input);

    expect(takeRightClick(input)).toBeNull();
  });
});
