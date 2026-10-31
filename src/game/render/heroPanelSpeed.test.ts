import { describe, expect, it } from "vitest";
import { emptyBelt } from "../sim/belt";
import type { Belongings } from "../sim/inventory";
import { overlaps, type Rect } from "../sim/rect";
import { createWorld } from "../sim/world";
import { viewportOf } from "../viewport";
import {
  heroPanelLayout,
  heroPanelRow,
  heroSheet,
  PANEL_ROWS,
} from "./heroPanel";

const town = {
  orientation: "orthogonal",
  width: 3,
  height: 1,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "floor", width: 3, height: 1, data: [1, 1, 1] },
    {
      type: "objectgroup",
      name: "objects",
      objects: [{ name: "start", type: "entry", point: true, x: 16, y: 16 }],
    },
  ],
};

/** Whether `rect` lies wholly inside `outer`. */
function inside(outer: Rect, rect: Rect): boolean {
  return (
    rect.x >= outer.x &&
    rect.y >= outer.y &&
    rect.x + rect.w <= outer.x + outer.w &&
    rect.y + rect.h <= outer.y + outer.h
  );
}

const worldWith = (equipment: Belongings["equipment"]) =>
  createWorld({
    areas: { town },
    seed: 1,
    belongings: { inventory: [], equipment, belt: emptyBelt() },
  });

const gloves: Belongings["equipment"] = {
  gloves: {
    type: "leatherGloves",
    rarity: "magic",
    affixes: [{ kind: "attackSpeed", grade: 0, value: 12 }],
  },
};
const boots: Belongings["equipment"] = {
  boots: {
    type: "leatherBoots",
    rarity: "magic",
    affixes: [{ kind: "walkSpeed", grade: 0, value: 9 }],
  },
};

const lines = (equipment: Belongings["equipment"]) =>
  heroSheet(worldWith(equipment))
    .derived.filter((d) => /speed/i.test(d.name))
    .map(({ name, value }) => ({ name, value }));

describe("heroSheet with Gloves and Boots of speed", () => {
  it("shows neither line while both bonuses are 0", () => {
    expect(lines({})).toEqual([]);
  });

  it("shows the attack speed bonus when it isn't 0", () => {
    expect(lines(gloves)).toEqual([{ name: "Attack Speed", value: "+12%" }]);
  });

  it("shows the walk speed bonus when it isn't 0", () => {
    expect(lines(boots)).toEqual([{ name: "Walk Speed", value: "+9%" }]);
  });

  it("fits the desktop panel, clear of the close hint, and the Compact Layout", () => {
    const count = heroSheet(worldWith({ ...gloves, ...boots })).derived.length;
    for (const size of [
      { width: 1280, height: 720 },
      { width: 844, height: 390 },
      { width: 568, height: 320 },
    ]) {
      const screen = viewportOf(size);
      const { panel, closeHint } = heroPanelLayout(screen);
      for (let i = 0; i < count; i++) {
        const row = heroPanelRow(screen, PANEL_ROWS.derived + i);
        expect(inside(panel, row)).toBe(true);
        if (!screen.compact) {
          expect(row.y + row.h).toBeLessThanOrEqual(closeHint.y);
        }
      }
    }
  });

  it.each([
    { width: 1280, height: 800 },
    { width: 1280, height: 720 },
    { width: 1024, height: 640 },
    { width: 800, height: 600 },
  ])("keeps the desktop derived rows apart, in the panel and clear of Level Up on $width×$height", (size) => {
    const screen = viewportOf(size);
    expect(screen.compact).toBe(false);
    const count = heroSheet(worldWith({ ...gloves, ...boots })).derived.length;
    const { panel, closeHint, levelUp } = heroPanelLayout(screen);
    const rows = Array.from({ length: count }, (_, i) =>
      heroPanelRow(screen, PANEL_ROWS.derived + i),
    );
    for (const [i, row] of rows.entries()) {
      expect(inside(panel, row), `row ${i} in the panel`).toBe(true);
      expect(overlaps(row, levelUp), `row ${i} and Level Up`).toBe(false);
      expect(overlaps(row, closeHint), `row ${i} and the close hint`).toBe(
        false,
      );
      for (const [j, other] of rows.slice(i + 1).entries()) {
        expect(overlaps(row, other), `rows ${i} and ${i + 1 + j}`).toBe(false);
      }
    }
    expect(
      inside({ x: 0, y: 0, w: screen.width, h: screen.height }, panel),
    ).toBe(true);
  });
});
