import { describe, expect, it } from "vitest";
import { createWorld, type Progress, step } from "../sim/world";
import {
  characterLayout,
  characterSheet,
  panelTargetAt,
} from "./characterPanel";

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

function world(progress?: Progress) {
  return createWorld({ areas: { town }, seed: 1, progress });
}

describe("characterSheet", () => {
  it("shows a fresh Hero's Level, Experience, Attributes and what they add up to", () => {
    expect(characterSheet(world())).toEqual({
      level: "Level 1",
      experience: "0 / 500",
      attributes: [
        { attribute: "strength", name: "Strength", value: "20" },
        { attribute: "dexterity", name: "Dexterity", value: "20" },
        { attribute: "vitality", name: "Vitality", value: "20" },
      ],
      attributePoints: "0",
      canRaise: false,
      stats: [
        { name: "Life", value: "100" },
        { name: "Damage", value: "20–30" },
        { name: "Attack Rating", value: "100" },
        { name: "Chance to hit a Skeleton", value: "85%" },
      ],
    });
  });

  it("shows a point the moment it's spent", () => {
    const w = world({
      level: 5,
      experience: 10_000,
      strength: 30,
      dexterity: 20,
      vitality: 20,
      attributePoints: 10,
    });
    step(w, [{ type: "SpendAttributePoint", attribute: "dexterity" }]);

    const sheet = characterSheet(w);
    expect(sheet).toMatchObject({
      level: "Level 5",
      experience: "10,000 / 14,175",
      attributePoints: "9",
      canRaise: true,
    });
    expect(sheet.attributes[1]).toMatchObject({ value: "21" });
    expect(sheet.stats).toEqual([
      { name: "Life", value: "108" },
      { name: "Damage", value: "22–33" },
      { name: "Attack Rating", value: "105" },
      // 2 × 105 / (105 + 135)
      { name: "Chance to hit a Skeleton", value: "88%" },
    ]);
  });
});

describe("panelTargetAt", () => {
  const screen = { width: 1280, height: 720 };
  const layout = characterLayout(screen);
  const centre = (rect: { x: number; y: number; w: number; h: number }) => ({
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  });

  it("finds the Level Up button only while points are unspent", () => {
    const at = centre(layout.levelUp);

    expect(panelTargetAt(screen, at, { open: false, points: 5 })).toEqual({
      type: "levelUp",
    });
    expect(panelTargetAt(screen, at, { open: false, points: 0 })).toBeNull();
  });

  it("finds a + button only while the panel is open with points unspent", () => {
    const at = centre(layout.raise.vitality);

    expect(panelTargetAt(screen, at, { open: true, points: 1 })).toEqual({
      type: "raise",
      attribute: "vitality",
    });
    expect(panelTargetAt(screen, at, { open: true, points: 0 })).toEqual({
      type: "panel",
    });
    expect(panelTargetAt(screen, at, { open: false, points: 1 })).toBeNull();
  });

  it("catches anywhere else on the open panel, and nothing off it", () => {
    const { panel } = layout;
    const inside = { x: panel.x + 2, y: panel.y + panel.h - 2 };
    const outside = { x: panel.x + panel.w + 2, y: panel.y + 2 };

    expect(panelTargetAt(screen, inside, { open: true, points: 0 })).toEqual({
      type: "panel",
    });
    expect(panelTargetAt(screen, inside, { open: false, points: 0 })).toBe(
      null,
    );
    expect(panelTargetAt(screen, outside, { open: true, points: 5 })).toBe(
      null,
    );
  });
});
