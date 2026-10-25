import { describe, expect, it } from "vitest";
import { town } from "../areas/town";
import { createWorld, step } from "./world";

// A 3×2 orthogonal map with 32 px tiles and a `start` Entry in the middle
// of tile (1, 1).
function tmj(objects: object[]) {
  return {
    orientation: "orthogonal",
    width: 3,
    height: 2,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 3,
        height: 2,
        data: [1, 1, 1, 1, 1, 0],
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

const start = { name: "start", type: "entry", point: true, x: 48, y: 48 };

describe("createWorld", () => {
  it("puts the Hero in Town at the `start` Entry", () => {
    const world = createWorld({ areas: { town: tmj([start]) }, seed: 1 });

    expect(world.areaName).toBe("town");
    expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });
  });

  it("puts the Hero at `start` in the shipped Town", () => {
    const world = createWorld({ areas: { town }, seed: 1 });

    expect(world.hero.pos).toEqual({ x: 2.5, y: 2.5 });
  });

  it("throws naming the Area when it has no `start` Entry", () => {
    const elsewhere = { ...start, name: "from-cave" };

    expect(() =>
      createWorld({ areas: { town: tmj([elsewhere]) }, seed: 1 }),
    ).toThrow('Area "town" has no "start" Entry');
  });

  it("reads Entries on isometric maps in tileheight units", () => {
    const iso = {
      ...tmj([{ ...start, x: 16, y: 48 }]),
      orientation: "isometric",
      tilewidth: 64,
    };

    const world = createWorld({ areas: { town: iso }, seed: 1 });

    expect(world.hero.pos).toEqual({ x: 0.5, y: 1.5 });
  });
});

describe("step", () => {
  it("keeps a resting Hero in place and reports nothing", () => {
    const world = createWorld({ areas: { town: tmj([start]) }, seed: 1 });

    const events = step(world, []);

    expect(events).toEqual([]);
    expect(world.tick).toBe(1);
    expect(world.hero.prevPos).toEqual({ x: 1.5, y: 1.5 });
    expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });
  });
});
