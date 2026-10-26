import { describe, expect, it } from "vitest";
import { ITEM_TYPES, isPotion } from "../tuning/items";
import { itemColour } from "./itemArt";

describe("an Item's colour", () => {
  it("is its own for each Potion type", () => {
    const potions = ITEM_TYPES.filter(isPotion);
    const colours = new Set(potions.map(itemColour));

    expect(potions).toEqual(
      expect.arrayContaining([
        "lifePotion",
        "manaPotion",
        "rejuvenationPotion",
      ]),
    );
    expect(colours.size).toBe(potions.length);
  });

  it("is red for a Life Potion, blue for a Mana Potion, purple for Rejuvenation", () => {
    const channels = (colour: number) => ({
      r: (colour >> 16) & 0xff,
      g: (colour >> 8) & 0xff,
      b: colour & 0xff,
    });
    const life = channels(itemColour("lifePotion"));
    const mana = channels(itemColour("manaPotion"));
    const rejuvenation = channels(itemColour("rejuvenationPotion"));

    expect(life.r).toBeGreaterThan(Math.max(life.g, life.b));
    expect(mana.b).toBeGreaterThan(Math.max(mana.r, mana.g));
    expect(Math.min(rejuvenation.r, rejuvenation.b)).toBeGreaterThan(
      rejuvenation.g,
    );
  });

  it("is shared by Items of the same kind other than Potions", () => {
    expect(itemColour("axe")).toBe(itemColour("shortSword"));
  });
});
