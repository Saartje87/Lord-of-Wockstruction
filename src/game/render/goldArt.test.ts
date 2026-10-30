import { describe, expect, it } from "vitest";
import { GOLD_COLOUR, goldPileLabel, goldTotalLabel } from "./goldArt";
import { rarityColour } from "./itemArt";

describe("Gold on screen", () => {
  it("labels a Gold Pile with its amount", () => {
    expect(goldPileLabel(37)).toBe("37 Gold");
    expect(goldPileLabel(1)).toBe("1 Gold");
  });

  it("shows the Hero's Gold in the Inventory panel", () => {
    expect(goldTotalLabel(0)).toBe("0 Gold");
    expect(goldTotalLabel(1250)).toBe("1250 Gold");
  });

  it("is a gold colour no Item's name uses", () => {
    expect(GOLD_COLOUR).not.toBe(rarityColour("normal"));
    expect(GOLD_COLOUR).not.toBe(rarityColour("magic"));
    // Red high, green high, blue low: a yellow-gold.
    const [r, g, b] = [
      GOLD_COLOUR >> 16,
      (GOLD_COLOUR >> 8) & 255,
      GOLD_COLOUR & 255,
    ];
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(150);
    expect(b).toBeLessThan(90);
  });
});
