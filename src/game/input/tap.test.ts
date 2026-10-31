import { describe, expect, it } from "vitest";
import { type CursorHit, clickCursor, createCursor } from "../cursor";
import { inventoryPanelLayout } from "../render/inventoryPanel";
import { emptyBelt } from "../sim/belt";
import { cursorItemOf } from "../sim/inventory";
import { createWorld, step } from "../sim/world";
import { inputTuning } from "../tuning/input";
import { viewportOf } from "../viewport";
import { cancelTap, createTapInput, tapDown, tapPointer, tapUp } from "./tap";

const SCREEN = viewportOf({ width: 1280, height: 800 });

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

/** An axe in the Inventory at (4, 1), and where a touch on it is. */
const withAxe = () =>
  createWorld({
    areas: { town },
    seed: 1,
    belongings: {
      inventory: [{ type: "axe", cell: { column: 4, row: 1 } }],
      equipment: {},
      belt: emptyBelt(),
    },
  });
const { grid, cell } = inventoryPanelLayout(SCREEN, 1);
const ON_AXE = {
  at: { x: grid.x + 4.5 * cell, y: grid.y + 1.5 * cell },
  hit: { inventory: { column: 4, row: 1 } } as CursorHit,
};
const ON_WORLD = { x: 640, y: 300 };

/** What a tap lifting off `world` at `nowMs` does there, as GameCanvas runs it. */
function liftOff(tap: ReturnType<typeof createTapInput>, nowMs: number) {
  const world = withAxe();
  const click = tapUp(tap, nowMs);
  if (click) {
    const { orders } = clickCursor(createCursor(), click, {
      world,
      screen: SCREEN,
      way: "touch",
    });
    step(world, orders);
  }
  return { click, world };
}

describe("a tap on the panels", () => {
  it("clicks where it came down as it lifts, lifting the Item there", () => {
    const tap = createTapInput();
    tapDown(tap, ON_AXE, 1000);

    const { click, world } = liftOff(tap, 1100);

    expect(click).toEqual(ON_AXE);
    expect(cursorItemOf(world)?.item.type).toBe("axe");
  });

  it("clicks only once", () => {
    const tap = createTapInput();
    tapDown(tap, ON_AXE, 1000);
    tapUp(tap, 1100);

    expect(tapUp(tap, 1200)).toBeNull();
  });

  it("is forgotten when cancelled, as by a pause", () => {
    const tap = createTapInput();
    tapDown(tap, ON_AXE, 1000);

    cancelTap(tap);

    expect(tapUp(tap, 1100)).toBeNull();
  });
});

describe("a long press on the panels", () => {
  it("shows no tooltip before the long-press time", () => {
    inputTuning.longPressMs = 500;
    const tap = createTapInput();
    tapDown(tap, ON_AXE, 1000);

    expect(tapPointer(tap, 1499, { holding: false, screen: ON_AXE.at })).toBe(
      null,
    );
  });

  it("shows the tooltip where it came down once held that long", () => {
    inputTuning.longPressMs = 500;
    const tap = createTapInput();
    tapDown(tap, ON_AXE, 1000);

    expect(
      tapPointer(tap, 1500, { holding: false, screen: ON_AXE.at }),
    ).toEqual(ON_AXE.at);
  });

  it("lifts nothing as it lets go, and the tooltip goes", () => {
    inputTuning.longPressMs = 500;
    const tap = createTapInput();
    tapDown(tap, ON_AXE, 1000);

    const { click, world } = liftOff(tap, 1500);

    expect(click).toBeNull();
    expect(cursorItemOf(world)).toBeNull();
    expect(tapPointer(tap, 1600, { holding: false, screen: null })).toBeNull();
  });
});

describe("where touch points", () => {
  it("is the finger on the World, for its hover", () => {
    const tap = createTapInput();

    expect(tapPointer(tap, 0, { holding: false, screen: ON_WORLD })).toEqual(
      ON_WORLD,
    );
  });

  it("keeps the Held Item where it was tapped up, the finger gone", () => {
    const tap = createTapInput();
    tapDown(tap, ON_AXE, 1000);
    tapUp(tap, 1100);

    expect(tapPointer(tap, 2000, { holding: true, screen: null })).toEqual(
      ON_AXE.at,
    );
  });

  it("shows nothing once the finger is gone with nothing held", () => {
    const tap = createTapInput();
    tapDown(tap, ON_AXE, 1000);
    tapUp(tap, 1100);

    expect(tapPointer(tap, 2000, { holding: false, screen: null })).toBeNull();
  });
});
