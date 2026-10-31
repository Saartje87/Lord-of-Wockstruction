import { describe, expect, it } from "vitest";
import { encodeSave, parseSave, SAVE_VERSION } from "./save";
import { emptyBelt } from "./sim/belt";
import type { Belongings } from "./sim/inventory";
import { FRESH_PROGRESS } from "./sim/world";

const BELONGINGS: Belongings = {
  inventory: [{ type: "buckler", cell: { column: 0, row: 0 } }],
  equipment: {
    weapon: { type: "shortSword" },
    helm: {
      type: "ironHelm",
      rarity: "magic",
      affixes: [{ kind: "enhancedDefense", grade: 1, value: 30 }],
      smithBonus: { bonus: "life", amount: 20 },
    },
    gloves: { type: "chainGloves" },
    boots: {
      type: "leatherBoots",
      rarity: "magic",
      affixes: [{ kind: "defense", grade: 0, value: 6 }],
    },
    offHand: {
      type: "towerShield",
      rarity: "magic",
      affixes: [{ kind: "life", grade: 0, value: 7 }],
      smithBonus: { bonus: "defense", amount: 12 },
    },
  },
  belt: emptyBelt(),
};

function textOf(belongings: Belongings) {
  return JSON.parse(
    encodeSave({
      progress: { ...FRESH_PROGRESS, smithService: "locked" },
      belongings,
    }),
  );
}

describe("the Save of the Helm, Gloves, Boots and Off-hand slots", () => {
  it("writes a version past 12", () => {
    expect(SAVE_VERSION).toBeGreaterThan(12);
  });

  it("round-trips every new slot with its Item, Affixes and Smith bonus", () => {
    const text = JSON.stringify(textOf(BELONGINGS));

    expect(parseSave(text)?.belongings).toEqual(BELONGINGS);
  });

  it("refuses an Item in a slot whose kinds don't include it", () => {
    for (const [slot, type] of [
      ["offHand", "axe"],
      ["offHand", "shortSword"],
      ["helm", "buckler"],
      ["gloves", "leatherBoots"],
      ["boots", "ironHelm"],
      ["weapon", "buckler"],
      ["armour", "ironHelm"],
    ] as const) {
      const text = textOf(BELONGINGS);
      text.equipment[slot] = { type };
      expect(parseSave(JSON.stringify(text)), `${type} in ${slot}`).toBeNull();
    }
  });

  it("refuses an Affix that doesn't roll on a new kind", () => {
    const text = textOf(BELONGINGS);
    text.equipment.helm.affixes = [{ kind: "brutality", grade: 0, value: 2 }];

    expect(parseSave(JSON.stringify(text))).toBeNull();
  });

  it("loads version 12 text with the five new slots empty and the rest as it was", () => {
    const old = textOf({
      inventory: [{ type: "axe", cell: { column: 2, row: 1 } }],
      equipment: {
        weapon: { type: "shortSword" },
        armour: { type: "chainMail" },
      },
      belt: emptyBelt(),
    });
    old.version = 12;

    const loaded = parseSave(JSON.stringify(old));

    expect(loaded?.belongings.equipment).toEqual({
      weapon: { type: "shortSword" },
      armour: { type: "chainMail" },
    });
    expect(loaded?.belongings.inventory).toEqual([
      { type: "axe", cell: { column: 2, row: 1 } },
    ]);
  });

  it("refuses version 12 text that already has a new slot", () => {
    const old = textOf(BELONGINGS);
    old.version = 12;

    expect(parseSave(JSON.stringify(old))).toBeNull();
  });
});
