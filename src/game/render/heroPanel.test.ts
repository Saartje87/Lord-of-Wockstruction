import { afterEach, describe, expect, it } from "vitest";
import {
  acceptPendingPoints,
  addPendingPoint,
  createMenus,
  noPendingPoints,
  pressKey,
} from "../menus";
import { changesSave, saveOf } from "../save";
import { emptyBelt } from "../sim/belt";
import { type Belongings, inventoryOf } from "../sim/inventory";
import { inside as insidePoint, overlaps, type Rect } from "../sim/rect";
import { emptySkillBar } from "../sim/skillBar";
import {
  type Attribute,
  attackRating,
  createWorld,
  FRESH_PROGRESS,
  maxLife,
  maxMana,
  type Progress,
  step,
  type World,
} from "../sim/world";
import { RESISTANCE_PENALTIES } from "../tuning/damage";
import { viewportOf } from "../viewport";
import {
  heroPanelHitAt,
  heroPanelLayout,
  heroPanelRow,
  heroSheet,
  levelUpHitAt,
  PANEL_ROWS,
} from "./heroPanel";

/** Whether `rect` lies wholly inside `outer`. */
function inside(outer: Rect, rect: Rect): boolean {
  return (
    insidePoint(outer, { x: rect.x, y: rect.y }) &&
    insidePoint(outer, { x: rect.x + rect.w, y: rect.y + rect.h })
  );
}

/** The top of the panel's first row, Level, under the title. */
const firstRowTop = () =>
  heroPanelRow(viewportOf({ width: 1280, height: 720 }), PANEL_ROWS.level).y;

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
    energy: 20,
    attributePoints: points,
    skillPoints: 0,
    skillLevels: { ...FRESH_PROGRESS.skillLevels, golem: 1 },
    skillBar: emptySkillBar(),
    touchedWaypoints: [...FRESH_PROGRESS.touchedWaypoints],
    smithService: "locked",
    gold: 0,
    quests: structuredClone(FRESH_PROGRESS.quests),
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
        inventory: [
          {
            type: "ring",
            rarity: "magic",
            affixes: [{ kind: "strength", grade: 1, value: 5 }],
            cell: { column: 0, row: 0 },
          },
        ],
        equipment: {
          weapon: { type: "shortSword" },
          armour: { type: "chainMail" },
          amulet: {
            type: "amulet",
            rarity: "magic",
            affixes: [{ kind: "vitality", grade: 1, value: 5 }],
          },
        },
        belt: emptyBelt(),
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
      "20",
    ]);
    expect(sheet.derived).toEqual([
      { name: "Life", value: "115", changed: false },
      { name: "Mana", value: "40 / 40", changed: false },
      { name: "Damage", value: "21–31", changed: false },
      { name: "Defense", value: "40", changed: false },
      { name: "Fire Resistance", value: "0%", changed: false, element: "fire" },
      { name: "Cold Resistance", value: "0%", changed: false, element: "cold" },
      {
        name: "Lightning Resistance",
        value: "0%",
        changed: false,
        element: "lightning",
      },
      { name: "Block", value: "0%", changed: false },
      { name: "Attack Rating", value: "100", changed: false },
      { name: "Chance to hit a Skeleton", value: "85%", changed: false },
    ]);
  });
});

describe("heroSheet with a Magic Item Equipped", () => {
  it("shows the totals with its Affixes included", () => {
    const w = createWorld({
      areas: { town },
      seed: 1,
      belongings: {
        inventory: [],
        equipment: {
          weapon: {
            type: "shortSword",
            rarity: "magic",
            affixes: [
              { kind: "brutality", grade: 0, value: 3 },
              { kind: "strength", grade: 0, value: 5 },
            ],
          },
          armour: {
            type: "chainMail",
            rarity: "magic",
            affixes: [{ kind: "defense", grade: 0, value: 8 }],
          },
        },
        belt: emptyBelt(),
      },
    });

    const sheet = heroSheet(w);

    expect(sheet.attributes[0].value).toBe("25");
    // (50/3 + 3) to (25 + 3), scaled by 25 Strength.
    expect(sheet.derived.find((d) => d.name === "Damage")?.value).toBe("25–35");
    expect(sheet.derived.find((d) => d.name === "Defense")?.value).toBe("48");
  });
});

describe("heroSheet with a Shield", () => {
  const withOffHand = (equipment: Belongings["equipment"]) =>
    heroSheet(
      createWorld({
        areas: { town },
        seed: 1,
        belongings: { inventory: [], equipment, belt: emptyBelt() },
      }),
    ).derived.find((d) => d.name === "Block");

  it("shows the Hero's Block chance", () => {
    expect(withOffHand({ offHand: { type: "buckler" } })?.value).toBe("15%");
    expect(
      withOffHand({
        offHand: {
          type: "buckler",
          rarity: "magic",
          affixes: [{ kind: "block", grade: 0, value: 4 }],
        },
      })?.value,
    ).toBe("19%");
  });

  it("shows 0% with no Shield", () => {
    expect(withOffHand({})?.value).toBe("0%");
  });
});

describe("heroSheet with the Mana and enhanced percent Affixes", () => {
  it("shows the new totals", () => {
    const w = createWorld({
      areas: { town },
      seed: 1,
      belongings: {
        inventory: [],
        equipment: {
          weapon: {
            type: "shortSword",
            rarity: "magic",
            affixes: [{ kind: "enhancedDamage", grade: 0, value: 20 }],
          },
          armour: {
            type: "chainMail",
            rarity: "magic",
            affixes: [{ kind: "enhancedDefense", grade: 0, value: 50 }],
          },
          amulet: {
            type: "amulet",
            rarity: "magic",
            affixes: [{ kind: "mana", grade: 0, value: 10 }],
          },
        },
        belt: emptyBelt(),
      },
    });

    const derived = heroSheet(w).derived;

    expect(derived.find((d) => d.name === "Defense")?.value).toBe("60");
    expect(derived.find((d) => d.name === "Damage")?.value).toBe("24–36");
    expect(derived.find((d) => d.name === "Mana")?.value).toMatch(/ \/ 50$/);
  });
});

describe("heroSheet with elemental damage Suffixes", () => {
  it("includes the elemental part in the Damage line", () => {
    const w = createWorld({
      areas: { town },
      seed: 1,
      belongings: {
        inventory: [],
        equipment: {
          weapon: {
            type: "axe",
            rarity: "magic",
            affixes: [
              { kind: "fireDamage", grade: 0, value: 3 },
              { kind: "coldDamage", grade: 0, value: 2 },
            ],
          },
        },
        belt: emptyBelt(),
      },
    });

    const damage = heroSheet(w).derived.find((d) => d.name === "Damage");
    // The Axe's 30–48 with 20 Strength, plus 5 unscaled.
    expect(damage?.value).toBe("35–53");
  });
});

describe("heroSheet", () => {
  it("shows a fresh Hero's Level, Experience, Attributes and what they add up to", () => {
    expect(heroSheet(world())).toEqual({
      level: "Level 1",
      experience: "0 / 500",
      attributes: [
        {
          attribute: "strength",
          name: "Strength",
          value: "20",
          changed: false,
          canLower: false,
        },
        {
          attribute: "dexterity",
          name: "Dexterity",
          value: "20",
          changed: false,
          canLower: false,
        },
        {
          attribute: "vitality",
          name: "Vitality",
          value: "20",
          changed: false,
          canLower: false,
        },
        {
          attribute: "energy",
          name: "Energy",
          value: "20",
          changed: false,
          canLower: false,
        },
      ],
      attributePoints: { value: "0", changed: false },
      canRaise: false,
      canAccept: false,
      derived: [
        { name: "Life", value: "100", changed: false },
        { name: "Mana", value: "40 / 40", changed: false },
        { name: "Damage", value: "20–30", changed: false },
        { name: "Defense", value: "0", changed: false },
        {
          name: "Fire Resistance",
          value: "0%",
          changed: false,
          element: "fire",
        },
        {
          name: "Cold Resistance",
          value: "0%",
          changed: false,
          element: "cold",
        },
        {
          name: "Lightning Resistance",
          value: "0%",
          changed: false,
          element: "lightning",
        },
        { name: "Block", value: "0%", changed: false },
        { name: "Attack Rating", value: "100", changed: false },
        { name: "Chance to hit a Skeleton", value: "85%", changed: false },
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
      energy: 20,
      attributePoints: 10,
      skillPoints: 4,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, golem: 0 },
      skillBar: emptySkillBar(),
      touchedWaypoints: [...FRESH_PROGRESS.touchedWaypoints],
      smithService: "locked",
      gold: 0,
      quests: structuredClone(FRESH_PROGRESS.quests),
    });
    step(w, [{ type: "SpendAttributePoints", points: { dexterity: 1 } }]);

    const sheet = heroSheet(w);
    expect(sheet).toMatchObject({
      level: "Level 5",
      experience: "10,000 / 14,175",
      attributePoints: { value: "9", changed: false },
      canRaise: true,
    });
    expect(sheet.attributes[1]).toMatchObject({ value: "21" });
    expect(sheet.derived).toEqual([
      { name: "Life", value: "108", changed: false },
      { name: "Mana", value: "44 / 44", changed: false },
      { name: "Damage", value: "22–33", changed: false },
      { name: "Defense", value: "0", changed: false },
      { name: "Fire Resistance", value: "0%", changed: false, element: "fire" },
      { name: "Cold Resistance", value: "0%", changed: false, element: "cold" },
      {
        name: "Lightning Resistance",
        value: "0%",
        changed: false,
        element: "lightning",
      },
      { name: "Block", value: "0%", changed: false },
      { name: "Attack Rating", value: "105", changed: false },
      // 2 × 105 / (105 + 135)
      { name: "Chance to hit a Skeleton", value: "88%", changed: false },
    ]);
  });

  it("shows current Mana, rounded down, against max Mana", () => {
    const w = world();
    w.hero.mana = 12.9;

    expect(heroSheet(w).derived).toContainEqual({
      name: "Mana",
      value: "12 / 40",
      changed: false,
    });
  });

  it("hides the + buttons while the Hero is dead, points or not", () => {
    const w = withPoints(5);
    kill(w);

    expect(heroSheet(w)).toMatchObject({
      attributePoints: { value: "5", changed: false },
      canRaise: false,
    });
  });
});

/** No Pending Attribute Points, but `points` on each Attribute named. */
function pending(points: Partial<Record<Attribute, number>>) {
  return { ...noPendingPoints(), ...points };
}

describe("heroSheet with Pending Attribute Points", () => {
  it("previews the Attributes and unspent points with them counted, highlighted", () => {
    const sheet = heroSheet(withPoints(5), pending({ strength: 2 }));

    expect(
      sheet.attributes.map(({ value, changed }) => [value, changed]),
    ).toEqual([
      ["22", true],
      ["20", false],
      ["20", false],
      ["20", false],
    ]);
    expect(sheet.attributePoints).toEqual({ value: "3", changed: true });
  });

  it("previews what the Attributes add up to, highlighting only what changed", () => {
    const w = withPoints(5);
    w.hero.mana = 30;

    const sheet = heroSheet(w, pending({ vitality: 1, energy: 2 }));

    expect(sheet.derived).toEqual([
      // 102 at Level 2, and 3 for the point of Vitality.
      { name: "Life", value: "105", changed: true },
      // Energy adds 2 a point to current and max Mana alike.
      { name: "Mana", value: "34 / 45", changed: true },
      { name: "Damage", value: "20–30", changed: false },
      { name: "Defense", value: "0", changed: false },
      { name: "Fire Resistance", value: "0%", changed: false, element: "fire" },
      { name: "Cold Resistance", value: "0%", changed: false, element: "cold" },
      {
        name: "Lightning Resistance",
        value: "0%",
        changed: false,
        element: "lightning",
      },
      { name: "Block", value: "0%", changed: false },
      { name: "Attack Rating", value: "100", changed: false },
      { name: "Chance to hit a Skeleton", value: "85%", changed: false },
    ]);
  });

  it("matches the World's own figures once they're accepted", () => {
    const w = withPoints(5);
    const points = pending({ strength: 1, dexterity: 3, vitality: 1 });
    const preview = heroSheet(w, points);

    step(w, [{ type: "SpendAttributePoints", points }]);
    const accepted = heroSheet(w);

    expect(preview.attributes.map(({ value }) => value)).toEqual(
      accepted.attributes.map(({ value }) => value),
    );
    expect(preview.attributePoints.value).toBe(accepted.attributePoints.value);
    expect(preview.derived.map(({ value }) => value)).toEqual(
      accepted.derived.map(({ value }) => value),
    );
    expect(accepted.derived).toContainEqual({
      name: "Attack Rating",
      value: String(attackRating(w)),
      changed: false,
    });
    expect(maxLife(w)).toBe(105);
    expect(maxMana(w)).toBe(41);
  });

  it("shows + while points are left to place, − on Attributes with pending points, and Accept", () => {
    const sheet = heroSheet(withPoints(5), pending({ dexterity: 1 }));

    expect(sheet.canRaise).toBe(true);
    expect(sheet.canAccept).toBe(true);
    expect(sheet.attributes.map(({ canLower }) => canLower)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it("hides + once every unspent point is pending", () => {
    const sheet = heroSheet(withPoints(2), pending({ energy: 2 }));

    expect(sheet.canRaise).toBe(false);
    expect(sheet.attributePoints.value).toBe("0");
    expect(sheet.canAccept).toBe(true);
  });
});

describe("a click on the Hero panel and the Level Up button", () => {
  const screen = viewportOf({ width: 1280, height: 720 });
  const layout = heroPanelLayout(screen);
  const centre = (rect: { x: number; y: number; w: number; h: number }) => ({
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  });

  it("finds the Level Up button only while points are unspent", () => {
    const at = centre(layout.levelUp);

    expect(levelUpHitAt(screen, at, withPoints(5))).toEqual({
      button: { type: "levelUp" },
    });
    expect(levelUpHitAt(screen, at, withPoints(0))).toBeNull();
  });

  it("finds the Level Up button while only Skill Points are unspent", () => {
    const w = world({
      level: 2,
      experience: 500,
      strength: 25,
      dexterity: 20,
      vitality: 20,
      energy: 20,
      attributePoints: 0,
      skillPoints: 1,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, golem: 0 },
      skillBar: emptySkillBar(),
      touchedWaypoints: [...FRESH_PROGRESS.touchedWaypoints],
      smithService: "locked",
      gold: 0,
      quests: structuredClone(FRESH_PROGRESS.quests),
    });

    expect(levelUpHitAt(screen, centre(layout.levelUp), w)).toEqual({
      button: { type: "levelUp" },
    });
  });

  it("finds a + button only while the panel is open with points unspent", () => {
    const at = centre(layout.raise.vitality);

    expect(heroPanelHitAt(screen, at, withPoints(1), true)).toEqual({
      button: { type: "raise", attribute: "vitality" },
    });
    expect(heroPanelHitAt(screen, at, withPoints(0), true)).toEqual({
      button: null,
    });
    expect(heroPanelHitAt(screen, at, withPoints(1), false)).toBeNull();
  });

  it("finds Energy's + button", () => {
    const at = centre(layout.raise.energy);

    expect(heroPanelHitAt(screen, at, withPoints(1), true)).toEqual({
      button: { type: "raise", attribute: "energy" },
    });
  });

  it("finds no + button while the Hero is dead", () => {
    const w = withPoints(1);
    kill(w);

    expect(
      heroPanelHitAt(screen, centre(layout.raise.vitality), w, true),
    ).toEqual({
      button: null,
    });
  });

  it("finds the × above the open panel's rows, points or not", () => {
    const { closeButton } = layout;
    const at = centre(closeButton);

    expect(closeButton.y + closeButton.h).toBeLessThanOrEqual(firstRowTop());
    expect(heroPanelHitAt(screen, at, withPoints(0), true)).toEqual({
      button: { type: "close", panel: "hero" },
    });
    expect(heroPanelHitAt(screen, at, withPoints(3), true)).toEqual({
      button: { type: "close", panel: "hero" },
    });
    expect(heroPanelHitAt(screen, at, withPoints(0), false)).toBeNull();
  });

  it("finds the × while the Hero is dead", () => {
    const w = withPoints(0);
    kill(w);

    expect(heroPanelHitAt(screen, centre(layout.closeButton), w, true)).toEqual(
      {
        button: { type: "close", panel: "hero" },
      },
    );
  });

  it("finds a − button only on an Attribute with Pending Attribute Points", () => {
    const at = centre(layout.lower.vitality);
    const w = withPoints(3);

    expect(
      heroPanelHitAt(screen, at, w, true, pending({ vitality: 1 })),
    ).toEqual({
      button: { type: "lower", attribute: "vitality" },
    });
    expect(heroPanelHitAt(screen, at, w, true, pending({ energy: 1 }))).toEqual(
      {
        button: null,
      },
    );
    expect(heroPanelHitAt(screen, at, w, true)).toEqual({ button: null });
  });

  it("finds Accept only while points are pending", () => {
    const at = centre(layout.accept);
    const w = withPoints(3);

    expect(heroPanelHitAt(screen, at, w, true, pending({ energy: 1 }))).toEqual(
      {
        button: { type: "accept" },
      },
    );
    expect(heroPanelHitAt(screen, at, w, true)).toEqual({ button: null });
  });

  it("finds no + once every unspent point is pending", () => {
    const at = centre(layout.raise.strength);

    expect(
      heroPanelHitAt(screen, at, withPoints(2), true, pending({ energy: 2 })),
    ).toEqual({ button: null });
    expect(
      heroPanelHitAt(screen, at, withPoints(3), true, pending({ energy: 2 })),
    ).toEqual({ button: { type: "raise", attribute: "strength" } });
  });

  it("keeps the Level Up button while every unspent point is pending", () => {
    const at = centre(layout.levelUp);
    const w = withPoints(2);

    expect(heroPanelHitAt(screen, at, w, true, pending({ strength: 2 }))).toBe(
      null,
    );
    expect(levelUpHitAt(screen, at, w)).toEqual({
      button: { type: "levelUp" },
    });
  });

  it("lays −, + and Accept out apart from each other and the values", () => {
    const rects = [
      ...Object.values(layout.raise),
      ...Object.values(layout.lower),
      layout.accept,
    ];
    for (const a of rects) {
      for (const b of rects) {
        if (a !== b) expect(overlaps(a, b)).toBe(false);
      }
      expect(inside(layout.panel, a)).toBe(true);
    }
  });

  it("catches anywhere else on the open panel, and nothing off it", () => {
    const { panel } = layout;
    const inside = { x: panel.x + 2, y: panel.y + panel.h - 2 };
    const outside = { x: panel.x + panel.w + 2, y: panel.y + 2 };

    expect(heroPanelHitAt(screen, inside, withPoints(0), true)).toEqual({
      button: null,
    });
    expect(heroPanelHitAt(screen, inside, withPoints(0), false)).toBeNull();
    expect(heroPanelHitAt(screen, outside, withPoints(5), true)).toBeNull();
  });
});

describe("Pending Attribute Points and the Save", () => {
  it("are never kept by the Save, until Accept spends them", () => {
    const w = withPoints(5);
    const menus = createMenus();
    pressKey(menus, "c", 1000, { heroDead: false });
    const hero = { heroDead: false, attributePoints: 5 };
    addPendingPoint(menus, "strength", hero);
    addPendingPoint(menus, "vitality", hero);

    expect(saveOf(w).progress).toMatchObject({
      strength: 20,
      vitality: 20,
      attributePoints: 5,
    });

    const accept = acceptPendingPoints(menus);
    const events = step(w, accept ? [accept] : []);

    expect(changesSave(events)).toBe(true);
    expect(saveOf(w).progress).toMatchObject({
      strength: 21,
      vitality: 21,
      attributePoints: 3,
    });
  });
});

describe("heroSheet's Resistance lines", () => {
  afterEach(() => {
    delete RESISTANCE_PENALTIES[2];
  });

  const wearingIn = (map: object, ...values: number[]) =>
    createWorld({
      areas: { town: map },
      seed: 1,
      belongings: {
        inventory: [],
        equipment: {
          ring1: values[0]
            ? {
                type: "ring",
                rarity: "magic",
                affixes: [
                  { kind: "coldResistance", grade: 2, value: values[0] },
                ],
              }
            : undefined,
          ring2: values[1]
            ? {
                type: "ring",
                rarity: "magic",
                affixes: [
                  { kind: "coldResistance", grade: 2, value: values[1] },
                ],
              }
            : undefined,
          amulet: values[2]
            ? {
                type: "amulet",
                rarity: "magic",
                affixes: [
                  { kind: "coldResistance", grade: 2, value: values[2] },
                ],
              }
            : undefined,
        },
        belt: emptyBelt(),
      },
    });
  const wearing = (...values: number[]) => wearingIn(town, ...values);
  const lines = (w: World) =>
    heroSheet(w)
      .derived.filter((d) => d.element)
      .map(({ name, value, element }) => ({ name, value, element }));

  it("sit right under Defense: Fire, Cold and Lightning at 0%", () => {
    const names = heroSheet(world()).derived.map((d) => d.name);
    const defense = names.indexOf("Defense");
    expect(names.slice(defense + 1, defense + 4)).toEqual([
      "Fire Resistance",
      "Cold Resistance",
      "Lightning Resistance",
    ]);
    expect(lines(world())).toEqual([
      { name: "Fire Resistance", value: "0%", element: "fire" },
      { name: "Cold Resistance", value: "0%", element: "cold" },
      { name: "Lightning Resistance", value: "0%", element: "lightning" },
    ]);
  });

  it("show the effective Resistance, and (capped) above 75%", () => {
    expect(lines(wearing(20, 20))[1].value).toBe("40%");
    expect(lines(wearing(25, 25, 25))[1].value).toBe("75%");
    expect(lines(wearing(30, 30, 30))[1].value).toBe("75% (capped)");
  });

  it("show the Resistance after the Resistance Penalty, (capped) only when what is left is above 75%", () => {
    const actTwo = {
      ...town,
      properties: [{ name: "act", type: "int", value: 2 }],
    };
    RESISTANCE_PENALTIES[2] = 30;
    expect(lines(wearingIn(actTwo, 30, 30, 30))[1].value).toBe("60%");
    expect(lines(wearingIn(actTwo, 20))[1].value).toBe("-10%");
    expect(lines(wearingIn(actTwo, 50, 50, 10))[1].value).toBe("75% (capped)");
    expect(lines(wearingIn(actTwo, 50, 30, 25))[1].value).toBe("75%");
  });

  it("fit the desktop panel and the Compact Layout", () => {
    for (const size of [
      { width: 1280, height: 720 },
      { width: 844, height: 390 },
    ]) {
      const screen = viewportOf(size);
      const { panel } = heroPanelLayout(screen);
      const count = heroSheet(world()).derived.length;
      for (let i = 0; i < count; i++) {
        const row = heroPanelRow(screen, PANEL_ROWS.derived + i);
        expect(inside(panel, row)).toBe(true);
      }
    }
  });
});
