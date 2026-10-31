import { describe, expect, it } from "vitest";
import { itemTooltip } from "./render/inventoryPanel";
import { encodeSave, parseSave } from "./save";
import { emptyBelt } from "./sim/belt";
import type { Belongings } from "./sim/inventory";
import { FRESH_PROGRESS } from "./sim/world";

const BELONGINGS: Belongings = {
  inventory: [],
  equipment: {
    gloves: {
      type: "chainGloves",
      rarity: "magic",
      affixes: [{ kind: "attackSpeed", grade: 1, value: 10 }],
    },
    boots: {
      type: "leatherBoots",
      rarity: "magic",
      affixes: [{ kind: "walkSpeed", grade: 2, value: 17 }],
    },
  },
  belt: emptyBelt(),
};

describe("the speed Affixes", () => {
  it("read +N% attack speed and +N% walk speed in a tooltip", () => {
    const lines = (slot: "gloves" | "boots") =>
      itemTooltip(BELONGINGS.equipment[slot] ?? { type: "ring" }).slice(1);
    expect(lines("gloves")).toContain("+10% Attack Speed");
    expect(lines("boots")).toContain("+17% Walk Speed");
  });

  it("survive a Save round trip", () => {
    const text = encodeSave({
      progress: FRESH_PROGRESS,
      belongings: BELONGINGS,
    });
    expect(parseSave(text)?.belongings.equipment).toMatchObject(
      BELONGINGS.equipment,
    );
  });

  it("are refused on Items they don't roll on", () => {
    const text = JSON.parse(
      encodeSave({ progress: FRESH_PROGRESS, belongings: BELONGINGS }),
    );
    text.equipment.gloves.affixes[0].kind = "walkSpeed";
    expect(parseSave(JSON.stringify(text))).toBeNull();
  });
});
