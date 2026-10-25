import { describe, expect, it } from "vitest";
import { createWorld, maxLife, progressOf } from "./world";

/** A Town of open floor with its `start` Entry in the middle tile. */
const town = {
  orientation: "orthogonal",
  width: 3,
  height: 1,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "floor", width: 3, height: 1, data: [1, 1, 1] },
    {
      type: "objectgroup",
      name: "objects",
      objects: [{ name: "start", type: "entry", point: true, x: 48, y: 16 }],
    },
  ],
};

describe("a World created from a saved progress", () => {
  it("starts the Hero in Town at start with that progress and full Life", () => {
    const w = createWorld({
      areas: { town },
      seed: 1,
      progress: { level: 5, experience: 10_000 },
    });

    expect(w.areaName).toBe("town");
    expect(w.hero.pos).toEqual({ x: 1.5, y: 0.5 });
    expect(progressOf(w)).toEqual({ level: 5, experience: 10_000 });
    // 100 and 2 more for each Level past the first.
    expect(maxLife(w)).toBe(108);
    expect(w.hero.life).toBe(108);
  });
});

describe("a World created without a saved progress", () => {
  it("starts a fresh Level 1 Hero with 100 Life", () => {
    const w = createWorld({ areas: { town }, seed: 1 });

    expect(progressOf(w)).toEqual({ level: 1, experience: 0 });
    expect(w.hero.life).toBe(100);
  });
});
