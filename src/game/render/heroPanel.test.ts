import { describe, expect, it } from "vitest";
import { inventoryOf } from "../sim/inventory";
import { createWorld, type Progress, step, type World } from "../sim/world";
import { heroPanelLayout, heroSheet, panelHitAt } from "./heroPanel";

/**
 * A Town of three tiles in a row, the Hero's `start` on the first and a
 * Skeleton on the last.
 */
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
      objects: [
        { name: "start", type: "entry", point: true, x: 16, y: 16 },
        {
          name: "",
          type: "monsterSpawn",
          point: true,
          x: 80,
          y: 16,
          properties: [
            { name: "monster", type: "string", value: "skeleton" },
            { name: "count", type: "int", value: 1 },
          ],
        },
      ],
    },
  ],
};

function world(progress?: Progress) {
  return createWorld({ areas: { town }, seed: 1, progress });
}

/** A Level 2 Hero at 20/20/20 with `points` of their 5 points unspent. */
function withPoints(points: number): World {
  return world({
    level: 2,
    experience: 500,
    strength: 25 - points,
    dexterity: 20,
    vitality: 20,
    attributePoints: points,
  });
}

/** Stands still by the Skeleton until it kills the Hero. */
function kill(w: World) {
  for (let i = 0; !w.death; i++) {
    if (i > 60 * 60) throw new Error("The Hero didn't die");
    step(w, []);
  }
}

describe("heroSheet with Items Equipped", () => {
  it("counts their bonuses in the Attributes and what they add up to", () => {
    const w = createWorld({
      areas: { town },
      seed: 1,
      belongings: {
        inventory: [{ type: "ringOfStrength", cell: { column: 0, row: 0 } }],
        equipment: {
          weapon: "shortSword",
          armour: "chainMail",
          amulet: "amuletOfVitality",
        },
      },
    });
    const before = heroSheet(w);
    const ring = inventoryOf(w)[0].item.id;

    step(w, [{ type: "EquipItem", item: ring }]);
    const sheet = heroSheet(w);

    expect(before.attributes[0].value).toBe("20");
    expect(sheet.attributes.map(({ value }) => value)).toEqual([
      "25",
      "20",
      "25",
    ]);
    expect(sheet.derived).toEqual([
      { name: "Life", value: "115" },
      { name: "Damage", value: "21–31" },
      { name: "Defense", value: "40" },
      { name: "Attack Rating", value: "100" },
      { name: "Chance to hit a Skeleton", value: "85%" },
    ]);
  });
});

describe("heroSheet", () => {
  it("shows a fresh Hero's Level, Experience, Attributes and what they add up to", () => {
    expect(heroSheet(world())).toEqual({
      level: "Level 1",
      experience: "0 / 500",
      attributes: [
        { attribute: "strength", name: "Strength", value: "20" },
        { attribute: "dexterity", name: "Dexterity", value: "20" },
        { attribute: "vitality", name: "Vitality", value: "20" },
      ],
      attributePoints: "0",
      canRaise: false,
      derived: [
        { name: "Life", value: "100" },
        { name: "Damage", value: "20–30" },
        { name: "Defense", value: "0" },
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

    const sheet = heroSheet(w);
    expect(sheet).toMatchObject({
      level: "Level 5",
      experience: "10,000 / 14,175",
      attributePoints: "9",
      canRaise: true,
    });
    expect(sheet.attributes[1]).toMatchObject({ value: "21" });
    expect(sheet.derived).toEqual([
      { name: "Life", value: "108" },
      { name: "Damage", value: "22–33" },
      { name: "Defense", value: "0" },
      { name: "Attack Rating", value: "105" },
      // 2 × 105 / (105 + 135)
      { name: "Chance to hit a Skeleton", value: "88%" },
    ]);
  });

  it("hides the + buttons while the Hero is dead, points or not", () => {
    const w = withPoints(5);
    kill(w);

    expect(heroSheet(w)).toMatchObject({
      attributePoints: "5",
      canRaise: false,
    });
  });
});

describe("panelHitAt", () => {
  const screen = { width: 1280, height: 720 };
  const layout = heroPanelLayout(screen);
  const centre = (rect: { x: number; y: number; w: number; h: number }) => ({
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  });

  it("finds the Level Up button only while points are unspent", () => {
    const at = centre(layout.levelUp);

    expect(panelHitAt(screen, at, withPoints(5), false)).toEqual({
      button: { type: "levelUp" },
    });
    expect(panelHitAt(screen, at, withPoints(0), false)).toBeNull();
  });

  it("finds a + button only while the panel is open with points unspent", () => {
    const at = centre(layout.raise.vitality);

    expect(panelHitAt(screen, at, withPoints(1), true)).toEqual({
      button: { type: "raise", attribute: "vitality" },
    });
    expect(panelHitAt(screen, at, withPoints(0), true)).toEqual({
      button: null,
    });
    expect(panelHitAt(screen, at, withPoints(1), false)).toBeNull();
  });

  it("finds no + button while the Hero is dead", () => {
    const w = withPoints(1);
    kill(w);

    expect(panelHitAt(screen, centre(layout.raise.vitality), w, true)).toEqual({
      button: null,
    });
  });

  it("catches anywhere else on the open panel, and nothing off it", () => {
    const { panel } = layout;
    const inside = { x: panel.x + 2, y: panel.y + panel.h - 2 };
    const outside = { x: panel.x + panel.w + 2, y: panel.y + 2 };

    expect(panelHitAt(screen, inside, withPoints(0), true)).toEqual({
      button: null,
    });
    expect(panelHitAt(screen, inside, withPoints(0), false)).toBeNull();
    expect(panelHitAt(screen, outside, withPoints(5), true)).toBeNull();
  });
});
