import { describe, expect, it } from "vitest";
import type { Vec } from "../sim/vec";
import {
  cancel,
  createPointerInput,
  move,
  poll,
  press,
  release,
} from "./pointer";

// Treat canvas pixels as tile units, so tests can speak in tiles, with no
// Monster or panel anywhere.
const asTiles = {
  toTile: (screen: Vec) => screen,
  monsterAt: () => null,
  onPanel: () => false,
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

/** Like `withMonster`, with a panel drawn over everything left of x = 4. */
const withPanel = {
  ...withMonster,
  onPanel: (screen: Vec) => screen.x < 4,
};

describe("pointer input on a panel", () => {
  it("hands a click on it back, ordering nothing", () => {
    const input = createPointerInput();

    press(input, { x: 2, y: 5 });

    expect(poll(input, 0, withPanel)).toEqual({
      orders: [],
      click: null,
      panel: { x: 2, y: 5 },
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
