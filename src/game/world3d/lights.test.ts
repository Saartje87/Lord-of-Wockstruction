import { describe, expect, it } from "vitest";
import { flicker, nearestLit } from "./lights";

const torch = (x: number, y: number, lit = true) => ({ pos: { x, y }, lit });

describe("which torches get the light pool", () => {
  it("gives the pool to the lit torches nearest the Hero, nearest first", () => {
    const torches = [torch(9, 0), torch(2, 0), torch(5, 0), torch(1, 0)];

    expect(nearestLit(torches, { x: 0, y: 0 }, 3)).toEqual([3, 1, 2]);
  });

  it("skips torches that are out", () => {
    const torches = [torch(1, 0, false), torch(4, 0), torch(6, 0)];

    expect(nearestLit(torches, { x: 0, y: 0 }, 2)).toEqual([1, 2]);
  });

  it("returns fewer than the pool when fewer torches are lit", () => {
    expect(nearestLit([torch(1, 0)], { x: 0, y: 0 }, 4)).toEqual([0]);
    expect(nearestLit([], { x: 0, y: 0 }, 4)).toEqual([]);
  });

  it("leaves out torches too far to light anything near the Hero", () => {
    expect(nearestLit([torch(40, 0)], { x: 0, y: 0 }, 4)).toEqual([]);
  });
});

describe("a torch's flicker", () => {
  it("wavers around full strength, never out", () => {
    for (let t = 0; t < 20; t += 0.1) {
      expect(flicker(t, 3)).toBeGreaterThan(0.6);
      expect(flicker(t, 3)).toBeLessThan(1.1);
    }
  });

  it("differs from torch to torch", () => {
    expect(flicker(1, 1)).not.toBeCloseTo(flicker(1, 2));
  });
});
