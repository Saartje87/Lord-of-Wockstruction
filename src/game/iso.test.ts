import { describe, expect, it } from "vitest";
import { TILE_HEIGHT, TILE_WIDTH, toScreen, toTile } from "./iso";

describe("isometric projection", () => {
  it("uses 2:1 diamonds", () => {
    expect(TILE_WIDTH).toBe(2 * TILE_HEIGHT);
  });

  it("puts the tile origin at the screen origin", () => {
    expect(toScreen({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("moves down-right along x and down-left along y", () => {
    expect(toScreen({ x: 1, y: 0 })).toEqual({ x: 96, y: 48 });
    expect(toScreen({ x: 0, y: 1 })).toEqual({ x: -96, y: 48 });
    expect(toScreen({ x: 2, y: 3 })).toEqual({ x: -96, y: 240 });
  });

  it("inverts back to tile units", () => {
    expect(toTile({ x: -96, y: 240 })).toEqual({ x: 2, y: 3 });
    expect(toTile({ x: 0, y: 48 })).toEqual({ x: 0.5, y: 0.5 });
  });
});
