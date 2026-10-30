import { describe, expect, it } from "vitest";
import { ITEM_TYPES, isPotion } from "../tuning/items";
import { itemColour, itemLabel, rarityColour } from "./itemArt";

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
  const ring = { name: "Ring of Life", shortName: "Life" };

  it("is the full name at 11 px when it fits on one line", () => {
    // "Ring of Life" is 12 characters, 66 px wide at 11 px.
    expect(itemLabel({ ...ring, width: 66, measure })).toEqual({
      text: "Ring of Life",
      size: 11,
    });
  });

  it("is the Short name at 11 px when the full name doesn't fit", () => {
    expect(itemLabel({ ...ring, width: 65, measure })).toEqual({
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

  it("shrinks a Short name to a size it truly fits at, though text doesn't narrow in step with its size", () => {
    /** Each character half the size wide, plus 1 px of spacing. */
    const spaced = (text: string, size: number) =>
      text.length * (size * 0.5 + 1);
    // "Rejuv" is 32.5 px wide at 11 px, and 31 px at 10.4 px: in step with
    // its size it would fit at 10.49 px, but is 31.2 px wide there.
    const rejuvenation = { name: "Rejuvenation Potion", shortName: "Rejuv" };

    const label = itemLabel({ ...rejuvenation, width: 31, measure: spaced });

    expect(label.text).toBe("Rejuv");
    expect(spaced(label.text, label.size)).toBeLessThanOrEqual(31);
    expect(label.size).toBeCloseTo(10.4, 1);
  });

  it("never shrinks below 10 px, however narrow the box", () => {
    expect(itemLabel({ ...ring, width: 5, measure })).toEqual({
      text: "Life",
      size: 10,
    });
  });

  it("grows with the UI Scale above 1, its floor too", () => {
    const rejuvenation = { name: "Rejuvenation Potion", shortName: "Rejuv" };

    // At 1.5, "Rejuv" is 41.25 px wide at 16.5 px, and 37.5 px at 15 px.
    expect(
      itemLabel({ ...rejuvenation, width: 50, measure, uiScale: 1.5 }),
    ).toEqual({ text: "Rejuv", size: 16.5 });
    expect(
      itemLabel({ ...rejuvenation, width: 5, measure, uiScale: 1.5 }),
    ).toEqual({ text: "Rejuv", size: 15 });
  });

  it("never shrinks with a UI Scale below 1", () => {
    expect(itemLabel({ ...ring, width: 65, measure, uiScale: 0.75 })).toEqual({
      text: "Life",
      size: 11,
    });
    expect(itemLabel({ ...ring, width: 5, measure, uiScale: 0.75 })).toEqual({
      text: "Life",
      size: 10,
    });
  });

  it("is never more than one line", () => {
    const widths = [1, 10, 20, 22, 30, 60, 66, 200];
    const labels = widths.map((width) =>
      itemLabel({ ...ring, width, measure }),
    );

    for (const label of labels) expect(label.text).not.toMatch(/\n/);
  });
});

describe("a Rarity's colour", () => {
  it("is white for Normal and blue for Magic", () => {
    expect(rarityColour("normal")).not.toBe(rarityColour("magic"));
    const blue = rarityColour("magic");
    expect(blue & 0xff).toBeGreaterThan((blue >> 16) & 0xff);
  });

  it("is yellow for Rare, with more red and green than blue", () => {
    const yellow = rarityColour("rare");

    expect(yellow).not.toBe(rarityColour("magic"));
    expect(yellow).not.toBe(rarityColour("normal"));
    expect((yellow >> 16) & 0xff).toBeGreaterThan((yellow & 0xff) + 100);
    expect((yellow >> 8) & 0xff).toBeGreaterThan((yellow & 0xff) + 100);
  });
});
