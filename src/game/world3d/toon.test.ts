import { describe, expect, it } from "vitest";
import { LOOKS, lookOf } from "./toon";

describe("the look of a KayKit piece", () => {
  it("keeps Town's dirt and paths warmer than the dungeon's stone", () => {
    for (const piece of ["halloween/floor_dirt", "halloween/path_B"]) {
      expect(lookOf(piece)).toBe(LOOKS.dusk);
    }
    expect(lookOf("dungeon/floor_tile_large")).toBe(LOOKS.stone);
    expect(LOOKS.dusk.saturation).toBeGreaterThan(LOOKS.stone.saturation);
  });

  it("leaves lanterns and pumpkins their warmth", () => {
    expect(lookOf("halloween/lantern_standing")).toBe(LOOKS.warm);
    expect(lookOf("halloween/pumpkin_orange_small")).toBe(LOOKS.warm);
  });
});
