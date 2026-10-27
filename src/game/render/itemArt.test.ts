import { describe, expect, it } from "vitest";
import { ITEM_TYPES, isPotion } from "../tuning/items";
import { itemColour, itemLabel } from "./itemArt";

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

describe("an Item's label", () => {
  /** A fake measure: each character half the text size wide. */
  const measure = (text: string, size: number) => text.length * size * 0.5;
  const ringOfLife = { name: "Ring of Life", shortName: "Life" };

  it("is the full name at 11 px when it fits on one line", () => {
    // "Ring of Life" is 12 characters, 66 px wide at 11 px.
    expect(itemLabel({ ...ringOfLife, width: 66, measure })).toEqual({
      text: "Ring of Life",
      size: 11,
    });
  });

  it("is the Short name at 11 px when the full name doesn't fit", () => {
    expect(itemLabel({ ...ringOfLife, width: 65, measure })).toEqual({
      text: "Life",
      size: 11,
    });
  });

  it("shrinks a Short name too wide at 11 px to the largest size that fits", () => {
    // "Rejuv" is 27.5 px wide at 11 px, 26 px at 10.4 px.
    const rejuvenation = { name: "Rejuvenation Potion", shortName: "Rejuv" };

    expect(itemLabel({ ...rejuvenation, width: 26, measure })).toEqual({
      text: "Rejuv",
      size: 10.4,
    });
  });

  it("never shrinks below 10 px, however narrow the box", () => {
    expect(itemLabel({ ...ringOfLife, width: 5, measure })).toEqual({
      text: "Life",
      size: 10,
    });
  });

  it("is never more than one line", () => {
    const widths = [1, 10, 20, 22, 30, 60, 66, 200];
    const labels = widths.map((width) =>
      itemLabel({ ...ringOfLife, width, measure }),
    );

    for (const label of labels) expect(label.text).not.toMatch(/\n/);
  });
});
