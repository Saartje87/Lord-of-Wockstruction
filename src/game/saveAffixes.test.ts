import { describe, expect, it } from "vitest";
import { encodeSave, parseSave, SAVE_VERSION } from "./save";
import { emptyBelt } from "./sim/belt";
import type { Belongings } from "./sim/inventory";
import { FRESH_PROGRESS } from "./sim/world";

const MAGIC_CHAIN = {
  type: "chainMail" as const,
  rarity: "magic" as const,
  affixes: [
    { kind: "defense" as const, grade: 1, value: 15 },
    { kind: "strength" as const, grade: 0, value: 2 },
  ],
};

const BELONGINGS: Belongings = {
  inventory: [{ ...MAGIC_CHAIN, cell: { column: 2, row: 1 } }],
  equipment: {
    weapon: {
      type: "axe",
      rarity: "magic",
      affixes: [{ kind: "brutality", grade: 2, value: 9 }],
      smithBonus: { bonus: "strength", amount: 4 },
    },
  },
  belt: emptyBelt(),
};

/** Saved text of the Belongings, as parsed JSON to tamper with. */
function textOf(belongings: Belongings) {
  return JSON.parse(
    encodeSave({
      progress: { ...FRESH_PROGRESS, smithService: "locked" },
      belongings,
    }),
  );
}

/** The text of `belongings` after `change` has tampered with it. */
function tampered(change: (text: Record<string, any>) => void) {
  const text = textOf(BELONGINGS);
  change(text);
  return JSON.stringify(text);
}

describe("the Save of Magic Items", () => {
  it("is version 12", () => {
    expect(SAVE_VERSION).toBe(12);
  });

  it("round-trips Rarity, Affixes (kind, grade, value) and the Smith bonus", () => {
    const loaded = parseSave(
      encodeSave({
        progress: { ...FRESH_PROGRESS, smithService: "locked" },
        belongings: BELONGINGS,
      }),
    );

    expect(loaded?.belongings).toEqual(BELONGINGS);
  });

  it("stores each Equipment slot as a whole Item, with no smithBonuses side map", () => {
    const text = textOf(BELONGINGS);

    expect(text.smithBonuses).toBeUndefined();
    expect(text.equipment.weapon).toEqual({
      type: "axe",
      rarity: "magic",
      affixes: [{ kind: "brutality", grade: 2, value: 9 }],
      smithBonus: { bonus: "strength", amount: 4 },
    });
  });

  it.each([
    [
      "an unknown Affix kind",
      (t: any) => (t.inventory[0].affixes[0].kind = "luck"),
    ],
    [
      "an Affix that doesn't suit the Item",
      (t: any) => (t.inventory[0].affixes[0].kind = "brutality"),
    ],
    [
      "two Affixes of one kind",
      (t: any) =>
        (t.inventory[0].affixes[1] = { kind: "defense", grade: 0, value: 6 }),
    ],
    [
      "two Prefixes",
      (t: any) =>
        (t.inventory[0].affixes[1] = { kind: "life", grade: 0, value: 6 }),
    ],
    ["a Magic Item with no Affixes", (t: any) => (t.inventory[0].affixes = [])],
    [
      "a Magic Item with three Affixes",
      (t: any) =>
        t.inventory[0].affixes.push(
          { kind: "energy", grade: 0, value: 2 },
          {
            kind: "life",
            grade: 0,
            value: 6,
          },
        ),
    ],
    [
      "a Normal Item with Affixes",
      (t: any) => (t.inventory[0].rarity = "normal"),
    ],
    ["an unknown Rarity", (t: any) => (t.inventory[0].rarity = "rare")],
    [
      "a grade that doesn't exist",
      (t: any) => (t.inventory[0].affixes[0].grade = 3),
    ],
    ["a fractional grade", (t: any) => (t.inventory[0].affixes[0].grade = 0.5)],
    [
      "a value below its grade's range",
      (t: any) => (t.inventory[0].affixes[0].value = 10),
    ],
    [
      "a value above its grade's range",
      (t: any) => (t.inventory[0].affixes[0].value = 21),
    ],
    [
      "a fractional value",
      (t: any) => (t.inventory[0].affixes[0].value = 15.5),
    ],
    [
      "a Magic Potion",
      (t: any) => (t.belt[0] = [{ type: "lifePotion", rarity: "magic" }]),
    ],
    [
      "a Magic Potion in the Inventory",
      (t: any) =>
        t.inventory.push({
          type: "lifePotion",
          rarity: "magic",
          affixes: [{ kind: "life", grade: 0, value: 6 }],
          cell: { column: 0, row: 0 },
        }),
    ],
    ["an Item without a Rarity", (t: any) => delete t.inventory[0].rarity],
    [
      "an Equipped Item that is only a type",
      (t: any) => (t.equipment.weapon = "axe"),
    ],
    ["a smithBonuses side map", (t: any) => (t.smithBonuses = {})],
  ])("is refused with %s", (_, change) => {
    expect(parseSave(tampered(change))).toBeNull();
  });
});

describe("older Saves", () => {
  it("load version 10 text with every Item Normal and the Smith bonuses folded into their slots", () => {
    const text = JSON.stringify({
      ...textOf({ inventory: [], equipment: {}, belt: emptyBelt() }),
      version: 10,
      gold: undefined,
      inventory: [
        {
          type: "chainMail",
          cell: { column: 2, row: 1 },
          smithBonus: { bonus: "defense", amount: 12 },
        },
      ],
      equipment: { weapon: "axe" },
      smithBonuses: { weapon: { bonus: "strength", amount: 4 } },
    });

    expect(parseSave(text)?.belongings).toEqual({
      inventory: [
        {
          type: "chainMail",
          cell: { column: 2, row: 1 },
          smithBonus: { bonus: "defense", amount: 12 },
        },
      ],
      equipment: {
        weapon: { type: "axe", smithBonus: { bonus: "strength", amount: 4 } },
      },
      belt: emptyBelt(),
    });
  });

  it("refuse version 10 text that already names a Rarity", () => {
    const text = JSON.stringify({
      ...textOf({ inventory: [], equipment: {}, belt: emptyBelt() }),
      version: 10,
      gold: undefined,
      inventory: [{ ...MAGIC_CHAIN, cell: { column: 2, row: 1 } }],
    });

    expect(parseSave(text)).toBeNull();
  });
});
