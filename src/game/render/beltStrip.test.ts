import { afterEach, describe, expect, it } from "vitest";
import { FRESH_BELONGINGS } from "../sim/inventory";
import { overlaps } from "../sim/rect";
import { createWorld, step, type World } from "../sim/world";
import { beltTuning } from "../tuning/items";
import { beltStripHitAt, beltStripLayout, beltStripSheet } from "./beltStrip";
import { skillBarLayout } from "./skillBar";

const town = {
  orientation: "orthogonal",
  width: 2,
  height: 1,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "floor", width: 2, height: 1, data: [1, 1] },
    {
      type: "objectgroup",
      name: "objects",
      objects: [{ name: "start", type: "entry", x: 16, y: 16 }],
    },
  ],
};

function world(belt?: string[][]): World {
  const belongings = belt
    ? { ...FRESH_BELONGINGS, belt: belt as never }
    : undefined;
  return createWorld({ areas: { town }, seed: 1, belongings });
}

afterEach(() => {
  beltTuning.rowsWithoutBelt = 1;
});

describe("the Belt strip's layout", () => {
  it.each([
    { width: 1280, height: 720 },
    { width: 1024, height: 640 },
  ])("sits left of the Skill Bar in line with it, clear of the Life orb at $width px", (screen) => {
    const columns = beltStripLayout(screen).columns;
    const { slots } = skillBarLayout(screen);

    expect(columns).toHaveLength(4);
    for (let i = 1; i < columns.length; i++) {
      expect(columns[i].x).toBeGreaterThan(columns[i - 1].x);
      expect(overlaps(columns[i], columns[i - 1])).toBe(false);
    }
    for (const column of columns) {
      expect(column.y).toBe(slots.key1.y);
      expect(column.h).toBe(slots.key1.h);
    }
    const last = columns[3];
    expect(last.x + last.w).toBeLessThan(slots.key1.x);
    // Clear of the Life orb's 144 px.
    expect(columns[0].x).toBeGreaterThan(144);
  });
});

describe("a click on the Belt strip", () => {
  const screen = { width: 1280, height: 720 };

  it("hits the Belt Column under it, so it's not for the World", () => {
    beltStripLayout(screen).columns.forEach((rect, column) => {
      const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
      expect(beltStripHitAt(screen, centre)).toEqual({
        button: { type: "beltColumn", column },
      });
    });
  });

  it("is for the World off the strip", () => {
    expect(beltStripHitAt(screen, { x: 640, y: 300 })).toBeNull();
  });
});

describe("the Belt strip's sheet", () => {
  it("shows each Belt Column's key, bottom Potion and count", () => {
    beltTuning.rowsWithoutBelt = 3;
    const w = world([
      ["lifePotion", "lifePotion", "lifePotion"],
      [],
      ["lifePotion"],
      [],
    ]);

    expect(beltStripSheet(w)).toEqual([
      {
        column: 0,
        key: "1",
        type: "lifePotion",
        name: "Life Potion",
        count: 3,
      },
      { column: 1, key: "2", type: null, name: null, count: 0 },
      {
        column: 2,
        key: "3",
        type: "lifePotion",
        name: "Life Potion",
        count: 1,
      },
      { column: 3, key: "4", type: null, name: null, count: 0 },
    ]);
  });

  it("follows drinking", () => {
    const w = world();

    step(w, [{ type: "DrinkFromBelt", column: 1 }]);

    expect(beltStripSheet(w).map(({ count }) => count)).toEqual([1, 0, 1, 1]);
  });
});
