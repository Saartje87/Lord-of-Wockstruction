import { describe, expect, it } from "vitest";
import {
  clickCursor,
  createCursor,
  pressCursor,
  releaseCursor,
} from "../cursor";
import { createMenus } from "../menus";
import { belongingsOf, cursorItemOf } from "../sim/inventory";
import { inside, middleOf, overlaps, type Rect } from "../sim/rect";
import { itemValue } from "../sim/value";
import { goodsOf } from "../sim/vendor";
import { createWorld, step, type World } from "../sim/world";
import { isPotion } from "../tuning/items";
import { type Viewport, viewportOf } from "../viewport";
import { cursorHitAt, type ShownPanels } from "./cursorHit";
import { panelFocusSpots } from "./panelFocus";
import {
  goodTooltip,
  vendorFocusSpots,
  vendorHitAt,
  vendorPanelLayout,
} from "./vendorPanel";

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

function newWorld(gold = 1000): World {
  const world = createWorld({ areas: { town }, seed: 4 });
  world.hero.progress.gold = gold;
  return world;
}

const shown: ShownPanels = {
  ...createMenus(),
  vendorOpen: true,
};

const SCREENS: [string, Viewport][] = [
  ["wide", viewportOf({ width: 1280, height: 800 })],
  ["narrow", viewportOf({ width: 800, height: 600 })],
  ["compact", viewportOf({ width: 800, height: 400 })],
  ["small compact", viewportOf({ width: 640, height: 360 })],
  ["scaled", viewportOf({ width: 1920, height: 1080 })],
];

/** Clicks `point` on the screen as the player would, sending its orders. */
function click(world: World, screen: Viewport, at: { x: number; y: number }) {
  const hit = cursorHitAt(screen, at, world, shown);
  const outcome = clickCursor(createCursor(), { at, hit }, { world, screen });
  step(world, outcome.orders);
  return outcome;
}

/** The middle of the Vendor grid cell the first good of the kind covers. */
function goodPoint(world: World, screen: Viewport, potion: boolean) {
  const layout = vendorPanelLayout(screen);
  const good = goodsOf(world).find(
    ({ item }) => isPotion(item.type) === potion,
  );
  if (!good) throw new Error("No such good");
  return {
    good,
    at: {
      x: layout.goods.x + (good.cell.column + 0.5) * layout.cell,
      y: layout.goods.y + (good.cell.row + 0.5) * layout.cell,
    },
  };
}

describe.each(SCREENS)("the Vendor panel's layout (%s)", (_, screen) => {
  const layout = vendorPanelLayout(screen);

  it("stays on the screen, the grids and × inside the panel", () => {
    const { panel } = layout;
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.w).toBeLessThanOrEqual(screen.width);
    expect(panel.y + panel.h).toBeLessThanOrEqual(screen.height);
    for (const rect of [layout.goods, layout.inventory, layout.closeButton]) {
      expect(rect.x).toBeGreaterThanOrEqual(panel.x);
      expect(rect.y).toBeGreaterThanOrEqual(panel.y);
      expect(rect.x + rect.w).toBeLessThanOrEqual(panel.x + panel.w);
      expect(rect.y + rect.h).toBeLessThanOrEqual(panel.y + panel.h);
    }
  });

  it("puts the Vendor's grid beside the Inventory grid, apart", () => {
    expect(overlaps(layout.goods, layout.inventory)).toBe(false);
    expect(layout.goods.x + layout.goods.w).toBeLessThanOrEqual(
      layout.inventory.x,
    );
    expect(overlaps(layout.closeButton, layout.goods)).toBe(false);
    expect(overlaps(layout.closeButton, layout.inventory)).toBe(false);
  });

  it("has the Focus rest on every cell and the ×, each where a click hits it", () => {
    const world = newWorld();
    const spots = panelFocusSpots("vendor", world, screen);
    expect(spots).toEqual(vendorFocusSpots(world, screen));
    for (const spot of spots) {
      expect(inside(spot.rect, spot.at)).toBe(true);
      expect(cursorHitAt(screen, spot.at, world, shown)).toEqual(spot.hit);
    }
  });

  it("takes a touch on the × from its hit area, and on a cell only inside it", () => {
    const world = newWorld();
    const { closeButton: close } = layout;
    const near = { x: close.x - 3, y: close.y + close.h / 2 };
    expect(cursorHitAt(screen, near, world, shown, true)).toEqual({
      button: { type: "close", panel: "vendor" },
    });
    const cell = middleOf({
      x: layout.goods.x,
      y: layout.goods.y,
      w: layout.cell,
      h: layout.cell,
    });
    expect(cursorHitAt(screen, cell, world, shown, true)).toEqual({
      vendor: { good: { column: 0, row: 0 } },
    });
  });
});

describe("the Vendor panel's hits", () => {
  const screen = SCREENS[0][1];
  const layout = vendorPanelLayout(screen);

  it("are none while the panel is shut, and for the World off it", () => {
    expect(
      vendorHitAt(screen, middleOf(layout.goods), false, false),
    ).toBeNull();
    expect(vendorHitAt(screen, { x: 5, y: 700 }, true, false)).toBeNull();
  });

  it("are a drop off the panel while holding", () => {
    expect(vendorHitAt(screen, { x: 5, y: 700 }, true, true)).toEqual({
      drop: true,
    });
  });

  it("tell the two grids apart", () => {
    expect(vendorHitAt(screen, middleOf(layout.goods), true, false)).toEqual({
      vendor: { good: { column: 4, row: 3 } },
    });
    expect(
      vendorHitAt(screen, middleOf(layout.inventory), true, false),
    ).toEqual({ vendor: { inventory: { column: 5, row: 2 } } });
  });

  it("are the panel itself between the grids", () => {
    const between: Rect = layout.panel;
    expect(
      vendorHitAt(screen, { x: between.x + 2, y: between.y + 2 }, true, false),
    ).toEqual({ vendor: null });
  });
});

describe("buying through the panel", () => {
  const screen = SCREENS[0][1];
  const layout = vendorPanelLayout(screen);
  const inventoryCell = (column: number, row: number) => ({
    x: layout.inventory.x + (column + 0.5) * layout.cell,
    y: layout.inventory.y + (row + 0.5) * layout.cell,
  });

  it("lifts a good with a click and buys it with a click on the Inventory grid", () => {
    const world = newWorld(500);
    const { good, at } = goodPoint(world, screen, false);
    click(world, screen, at);
    expect(cursorItemOf(world)?.item.type).toBe(good.item.type);
    expect(world.hero.progress.gold).toBe(500);
    click(world, screen, inventoryCell(2, 1));
    expect(cursorItemOf(world)).toBeNull();
    expect(world.hero.progress.gold).toBe(500 - itemValue(good.item));
    expect(belongingsOf(world).inventory).toHaveLength(1);
  });

  it("can't lift a good the Hero can't afford", () => {
    const world = newWorld(1);
    const { at } = goodPoint(world, screen, false);
    click(world, screen, at);
    expect(cursorItemOf(world)).toBeNull();
  });

  it("gives a held good back with a click elsewhere on the panel, at no cost", () => {
    const world = newWorld(500);
    const { at } = goodPoint(world, screen, false);
    const before = goodsOf(world).length;
    click(world, screen, at);
    click(world, screen, { x: layout.panel.x + 2, y: layout.panel.y + 2 });
    expect(cursorItemOf(world)).toBeNull();
    expect(world.hero.progress.gold).toBe(500);
    expect(goodsOf(world)).toHaveLength(before);
  });

  it("gives a held good back with a click off the panel", () => {
    const world = newWorld(500);
    const { at } = goodPoint(world, screen, false);
    click(world, screen, at);
    const outcome = click(world, screen, { x: 5, y: 700 });
    expect(outcome.orders).toEqual([{ type: "DropItem" }]);
    expect(cursorItemOf(world)).toBeNull();
    expect(world.groundItems).toHaveLength(0);
    expect(world.hero.progress.gold).toBe(500);
  });

  it("buys with a Drag: pressed on the good, let go on the Inventory grid", () => {
    const world = newWorld(500);
    const { good, at } = goodPoint(world, screen, false);
    const send = (
      outcome: ReturnType<typeof pressCursor>,
    ): ReturnType<typeof pressCursor> => {
      step(world, outcome.orders);
      return outcome;
    };
    const press = send(
      pressCursor(
        createCursor(),
        { at, hit: cursorHitAt(screen, at, world, shown) },
        { world, screen },
      ),
    );
    expect(cursorItemOf(world)?.item.type).toBe(good.item.type);
    const to = inventoryCell(3, 2);
    send(
      releaseCursor(
        press.cursor,
        { at: to, hit: cursorHitAt(screen, to, world, shown) },
        { world, screen },
      ),
    );
    expect(cursorItemOf(world)).toBeNull();
    expect(world.hero.progress.gold).toBe(500 - itemValue(good.item));
  });

  it("keeps a good held when it is let go over the cell it was lifted from", () => {
    const world = newWorld(500);
    const { at } = goodPoint(world, screen, false);
    const hit = cursorHitAt(screen, at, world, shown);
    const press = pressCursor(createCursor(), { at, hit }, { world, screen });
    step(world, press.orders);
    const release = releaseCursor(press.cursor, { at, hit }, { world, screen });
    expect(release.orders).toEqual([]);
    expect(cursorItemOf(world)).not.toBeNull();
  });

  it("refuses to buy onto an Item, staying held", () => {
    const world = newWorld(500);
    const { at } = goodPoint(world, screen, true);
    click(world, screen, at);
    click(world, screen, inventoryCell(0, 0));
    // The first Potion is bought; a second one onto it is refused.
    const { at: again } = goodPoint(world, screen, true);
    click(world, screen, again);
    const gold = world.hero.progress.gold;
    click(world, screen, inventoryCell(0, 0));
    expect(world.hero.progress.gold).toBe(gold);
    expect(cursorItemOf(world)).not.toBeNull();
  });
});

describe("a good's tooltip", () => {
  it("adds the Value to the Item's own lines and says whether it's affordable", () => {
    const world = newWorld();
    const { good } = goodPoint(world, SCREENS[0][1], false);
    const value = itemValue(good.item);
    const poor = goodTooltip(good.item, value - 1);
    expect(poor.lines.at(-1)).toBe(`Value: ${value} Gold`);
    expect(poor.affordable).toBe(false);
    expect(goodTooltip(good.item, value).affordable).toBe(true);
  });
});
