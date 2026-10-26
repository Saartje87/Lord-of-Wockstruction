import { describe, expect, it } from "vitest";
import { createWorld, step } from "../sim/world";
import { orbFill } from "./orbs";

/** A Town of open floor with its `start` Entry on the first tile. */
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
      objects: [{ name: "start", type: "entry", point: true, x: 16, y: 16 }],
    },
  ],
};

describe("orbFill", () => {
  it("shows a fresh Hero's Life and Mana orbs full", () => {
    const w = createWorld({ areas: { town }, seed: 1 });

    expect(orbFill(w, "life")).toBe(1);
    expect(orbFill(w, "mana")).toBe(1);
  });

  it("fills the Mana orb by current over max Mana", () => {
    const w = createWorld({ areas: { town }, seed: 1 });
    w.hero.mana = 10;

    // 10 of a fresh Hero's 40.
    expect(orbFill(w, "mana")).toBe(0.25);
    expect(orbFill(w, "life")).toBe(1);
  });

  it("rises with the Mana regenerated", () => {
    const w = createWorld({ areas: { town }, seed: 1 });
    w.hero.mana = 0;

    // 2 Mana in a second.
    for (let i = 0; i < 60; i++) step(w, []);

    expect(orbFill(w, "mana")).toBeCloseTo(0.05);
  });

  it("fills the Life orb by current over max Life", () => {
    const w = createWorld({ areas: { town }, seed: 1 });
    w.hero.life = 75;

    expect(orbFill(w, "life")).toBe(0.75);
  });
});
