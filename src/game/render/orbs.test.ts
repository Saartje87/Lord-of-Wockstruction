import { describe, expect, it } from "vitest";
import { createWorld, step } from "../sim/world";
import {
  heroHitShows,
  orbFill,
  WARD_PULSE,
  wardFill,
  wardPulseBrightness,
} from "./orbs";

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

describe("wardFill", () => {
  it("shows no ring without a Bone Ward", () => {
    const w = createWorld({ areas: { town }, seed: 1 });

    expect(wardFill(w)).toBeNull();
  });

  it("shows how much of the Bone Ward is left", () => {
    const w = createWorld({ areas: { town }, seed: 1 });
    w.hero.boneWard = { left: 15, full: 20 };

    expect(wardFill(w)).toBe(0.75);
  });
});

describe("heroHitShows", () => {
  it("pulses the ring and no red flash for a hit soaked whole", () => {
    expect(heroHitShows([{ type: "HeroHit", damage: 0, warded: 8 }])).toEqual({
      hurt: false,
      pulses: true,
    });
  });

  it("flashes and pulses for a hit only partly soaked", () => {
    expect(heroHitShows([{ type: "HeroHit", damage: 3, warded: 5 }])).toEqual({
      hurt: true,
      pulses: true,
    });
  });

  it("only flashes for a hit with no Bone Ward", () => {
    expect(heroHitShows([{ type: "HeroHit", damage: 8, warded: 0 }])).toEqual({
      hurt: true,
      pulses: false,
    });
  });

  it("shows nothing for a Miss or no hit", () => {
    expect(heroHitShows([{ type: "Missed", target: "hero" }])).toEqual({
      hurt: false,
      pulses: false,
    });
    expect(heroHitShows([])).toEqual({ hurt: false, pulses: false });
  });
});

describe("wardPulseBrightness", () => {
  it("is brightest when it begins and fades to nothing over its length", () => {
    expect(wardPulseBrightness(0)).toBe(1);
    expect(wardPulseBrightness(WARD_PULSE.ms / 2)).toBeCloseTo(0.5);
    expect(wardPulseBrightness(WARD_PULSE.ms)).toBe(0);
    expect(wardPulseBrightness(WARD_PULSE.ms * 3)).toBe(0);
  });
});
