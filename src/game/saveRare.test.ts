import { describe, expect, it } from "vitest";
import { encodeSave, parseSave } from "./save";
import { parseSaveJson, type SaveJson } from "./saveTamper";
import { emptyBelt } from "./sim/belt";
import type { Belongings } from "./sim/inventory";
import { FRESH_PROGRESS } from "./sim/world";

const RARE_AXE = {
  type: "axe" as const,
  rarity: "rare" as const,
  rareName: "Gloom Bane",
  affixes: [
    { kind: "accuracy" as const, grade: 0, value: 12 },
    { kind: "life" as const, grade: 0, value: 7 },
    { kind: "strength" as const, grade: 0, value: 2 },
  ],
};

const BELONGINGS: Belongings = {
  inventory: [{ ...RARE_AXE, cell: { column: 1, row: 1 } }],
  equipment: { weapon: RARE_AXE },
  belt: emptyBelt(),
};

/** Saved text of the Belongings, tampered with by `change`. */
function tampered(change: (text: SaveJson) => void) {
  const text = parseSaveJson(
    encodeSave({
      progress: { ...FRESH_PROGRESS, smithService: "locked" },
      belongings: BELONGINGS,
    }),
  );
  change(text);
  return JSON.stringify(text);
}

describe("the Save of Rare Items", () => {
  it("round-trips the Rare name with the Rarity and Affixes", () => {
    const loaded = parseSave(tampered(() => {}));

    expect(loaded?.belongings).toEqual(BELONGINGS);
  });

  it.each([
    [
      "a Rare name on a Magic Item",
      (t: SaveJson) => {
        t.inventory[0].rarity = "magic";
        t.inventory[0].affixes.length = 1;
      },
    ],
    [
      "a Rare name on a Normal Item",
      (t: SaveJson) => {
        t.inventory[0].rarity = "normal";
        t.inventory[0].affixes = [];
      },
    ],
    [
      "a Rare name on an Equipped Normal Item",
      (t: SaveJson) => {
        t.equipment.weapon.rarity = "normal";
        t.equipment.weapon.affixes = [];
      },
    ],
    [
      "a Rare Item without a name",
      (t: SaveJson) => delete t.inventory[0].rareName,
    ],
    [
      "a Rare Item with a blank name",
      (t: SaveJson) => (t.inventory[0].rareName = " "),
    ],
    [
      "a Rare Item with a non-text name",
      (t: SaveJson) => (t.inventory[0].rareName = 5),
    ],
    [
      "a Rare Item with two Affixes",
      (t: SaveJson) => t.inventory[0].affixes.pop(),
    ],
    [
      "a Rare Item with five Affixes",
      (t: SaveJson) =>
        t.inventory[0].affixes.push(
          { kind: "dexterity", grade: 0, value: 2 },
          { kind: "vitality", grade: 0, value: 2 },
          { kind: "energy", grade: 0, value: 2 },
        ),
    ],
    [
      "a Rare Item with three Prefixes",
      (t: SaveJson) =>
        (t.inventory[0].affixes = [
          { kind: "accuracy", grade: 0, value: 12 },
          { kind: "life", grade: 0, value: 7 },
          { kind: "brutality", grade: 0, value: 2 },
        ]),
    ],
    [
      "a Rare Item with three Suffixes",
      (t: SaveJson) =>
        (t.inventory[0].affixes = [
          { kind: "strength", grade: 0, value: 2 },
          { kind: "dexterity", grade: 0, value: 2 },
          { kind: "vitality", grade: 0, value: 2 },
        ]),
    ],
    [
      "a Rare Item with one kind twice",
      (t: SaveJson) =>
        (t.inventory[0].affixes[2] = { kind: "life", grade: 0, value: 7 }),
    ],
    [
      "a Rare Potion",
      (t: SaveJson) =>
        (t.belt[0] = [
          { type: "lifePotion", rarity: "rare", rareName: "Gloom Bane" },
        ]),
    ],
  ])("is refused with %s", (_, change) => {
    expect(parseSave(tampered(change))).toBeNull();
  });
});
