import { describe, expect, it } from "vitest";
import type { CursorHit } from "../cursor";
import { type FocusDirection, type FocusSpot, moveFocus } from "../input/focus";
import { emptyBelt } from "../sim/belt";
import { type Belongings, EQUIPMENT_SLOTS } from "../sim/inventory";
import { createWorld, step, type World } from "../sim/world";
import { inventoryTuning } from "../tuning/items";
import { type Viewport, viewportOf } from "../viewport";
import {
  inventoryHitAt,
  inventoryPanelLayout,
  landingCell,
} from "./inventoryPanel";
import { panelFocusSpots } from "./panelFocus";

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

const world = (belongings?: Belongings) =>
  createWorld({ areas: { town }, seed: 1, belongings });

const WIDE = viewportOf({ width: 1280, height: 800 });
const COMPACT = viewportOf({ width: 800, height: 400 });

/** Belongings with a Belt Equipped, so each Belt Column has four rows. */
const belted: Belongings = {
  inventory: [],
  equipment: { belt: "platedBelt" },
  belt: emptyBelt(),
};

const DIRECTIONS: FocusDirection[] = ["up", "down", "left", "right"];

const key = (hit: CursorHit | null) => JSON.stringify(hit);

/** The spot in `spots` whose hit is `hit`. */
function spotOf(spots: FocusSpot[], hit: CursorHit): FocusSpot {
  const spot = spots.find((one) => key(one.hit) === key(hit));
  if (!spot) throw new Error(`no spot for ${key(hit)}`);
  return spot;
}

/** Where the Focus goes from `hit` going `direction`, as a hit. */
function move(spots: FocusSpot[], hit: CursorHit, direction: FocusDirection) {
  return moveFocus(spots, spotOf(spots, hit), direction).hit;
}

const cell = (column: number, row: number) => ({
  inventory: { column, row },
});
const belt = (beltColumn: number, row: number) => ({
  inventory: { beltColumn, row },
});
const slot = (name: (typeof EQUIPMENT_SLOTS)[number]) => ({ inventory: name });
const close = { button: { type: "close", panel: "inventory" } } as const;

describe("the Inventory panel's Focus spots", () => {
  const screens: [string, Viewport][] = [
    ["wide", WIDE],
    ["compact", COMPACT],
  ];
  const worlds: [string, () => World][] = [
    ["no Belt", () => world()],
    ["a Belt", () => world(belted)],
  ];

  it.each(
    screens.flatMap(([name, screen]) =>
      worlds.map(([with_, made]) => [name, with_, screen, made] as const),
    ),
  )("are every cell, slot, Belt Column cell and the × (%s, %s)", (_, __, screen, made) => {
    const w = made();
    const rows = w.hero.equipment.belt ? 4 : 1;
    const spots = panelFocusSpots("inventory", w, screen);
    const { columns, rows: gridRows } = inventoryTuning;

    expect(spots).toHaveLength(columns * gridRows + 6 + 4 * rows + 1);
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < gridRows; row++) spotOf(spots, cell(column, row));
    }
    for (const name of EQUIPMENT_SLOTS) spotOf(spots, slot(name));
    for (let column = 0; column < 4; column++) {
      for (let row = 0; row < rows; row++) spotOf(spots, belt(column, row));
    }
    spotOf(spots, close);
  });

  it.each(
    screens.flatMap(([name, screen]) =>
      worlds.map(([with_, made]) => [name, with_, screen, made] as const),
    ),
  )("each point where a click hits it (%s, %s)", (_, __, screen, made) => {
    const w = made();
    const rows = w.hero.equipment.belt ? 4 : 1;
    for (const spot of panelFocusSpots("inventory", w, screen)) {
      expect(inventoryHitAt(screen, spot.at, true, false, rows)).toEqual(
        spot.hit,
      );
    }
  });

  it.each(
    screens.flatMap(([name, screen]) =>
      worlds.map(([with_, made]) => [name, with_, screen, made] as const),
    ),
  )("are each reachable from any other (%s, %s)", (_, __, screen, made) => {
    const spots = panelFocusSpots("inventory", made(), screen);
    for (const from of spots) {
      const reached = new Set([key(from.hit)]);
      const next = [from];
      while (next.length > 0) {
        const at = next.pop() as FocusSpot;
        for (const direction of DIRECTIONS) {
          const to = moveFocus(spots, at, direction);
          if (reached.has(key(to.hit))) continue;
          reached.add(key(to.hit));
          next.push(to);
        }
      }
      expect(reached.size).toBe(spots.length);
    }
  });

  it("moves one cell at a time across the grid, staying at its edges", () => {
    const spots = panelFocusSpots("inventory", world(), WIDE);
    const { columns, rows } = inventoryTuning;
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const from = cell(column, row);
        expect(move(spots, from, "left")).toEqual(
          cell(Math.max(0, column - 1), row),
        );
        expect(move(spots, from, "right")).toEqual(
          column === columns - 1 ? from : cell(column + 1, row),
        );
        expect(move(spots, from, "down")).toEqual(
          cell(column, Math.min(rows - 1, row + 1)),
        );
        if (row > 0)
          expect(move(spots, from, "up")).toEqual(cell(column, row - 1));
      }
    }
  });

  it("goes up from the grid's top row to what lies above it", () => {
    const spots = panelFocusSpots("inventory", world(), WIDE);

    expect(move(spots, cell(0, 0), "up")).toEqual(slot("weapon"));
    expect(move(spots, cell(3, 0), "up")).toEqual(belt(0, 0));
    expect(move(spots, cell(6, 0), "up")).toEqual(belt(3, 0));
    expect(move(spots, cell(9, 0), "up")).toEqual(belt(3, 0));
  });

  it("goes up and down a Belt Column, and from it to the grid and the Belt", () => {
    const spots = panelFocusSpots("inventory", world(belted), WIDE);

    expect(move(spots, belt(1, 0), "up")).toEqual(belt(1, 1));
    expect(move(spots, belt(1, 1), "down")).toEqual(belt(1, 0));
    expect(move(spots, belt(1, 3), "up")).toEqual(slot("belt"));
    expect(move(spots, belt(0, 0), "down")).toEqual(cell(3, 0));
    expect(move(spots, belt(0, 2), "right")).toEqual(belt(1, 2));
  });

  it("goes between the Equipment slots as they lie", () => {
    const spots = panelFocusSpots("inventory", world(), WIDE);

    expect(move(spots, slot("weapon"), "right")).toEqual(slot("armour"));
    expect(move(spots, slot("armour"), "left")).toEqual(slot("weapon"));
    expect(move(spots, slot("armour"), "right")).toEqual(slot("amulet"));
    expect(move(spots, slot("armour"), "down")).toEqual(slot("belt"));
    expect(move(spots, slot("belt"), "left")).toEqual(slot("ring1"));
    expect(move(spots, slot("belt"), "right")).toEqual(slot("ring2"));
    expect(move(spots, slot("amulet"), "up")).toEqual(close);
  });

  it("are none for a shut panel, or one with no Focus spots yet", () => {
    expect(panelFocusSpots(null, world(), WIDE)).toEqual([]);
  });

  it("lands a held Item on the focused cell, kept on the grid", () => {
    const w = world({
      inventory: [{ type: "axe", cell: { column: 0, row: 0 } }],
      equipment: {},
      belt: emptyBelt(),
    });
    step(w, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);
    const spots = panelFocusSpots("inventory", w, WIDE);
    const layout = inventoryPanelLayout(WIDE, 1);
    const landsAt = (hit: CursorHit) =>
      landingCell(layout, spotOf(spots, hit).at, "axe");

    // An Axe is 2×3.
    expect(landsAt(cell(4, 1))).toEqual({ column: 4, row: 1 });
    expect(landsAt(cell(9, 3))).toEqual({ column: 8, row: 1 });
  });
});
