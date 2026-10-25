import { describe, expect, it } from "vitest";
import { town } from "../areas/town";
import { createWorld, step, type World } from "./world";

// A 3×2 orthogonal Area with 32 px tiles and a `start` Entry in the middle
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

    expect(world.hero.pos).toEqual({ x: 5.5, y: 4.5 });
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

// An 8×8 orthogonal Area of open floor, but for a hole at (6, 6), with
// `start` in the middle of (1, 1).
function openFloor() {
  const data = new Array(64).fill(1);
  data[6 * 8 + 6] = 0;
  return {
    orientation: "orthogonal",
    width: 8,
    height: 8,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 8,
        height: 8,
        data,
      },
      { type: "objectgroup", name: "objects", objects: [start] },
    ],
  };
}

function stepTimes(world: World, times: number) {
  for (let i = 0; i < times; i++) step(world, []);
}

describe("MoveTo", () => {
  // At 5.5 tiles/s a 3-tile walk takes 3 / 5.5 s = 32.7 steps, so 33.
  it("walks the Hero to the target and stops on arrival", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });

    step(world, [{ type: "MoveTo", target: { x: 4.5, y: 1.5 } }]);
    stepTimes(world, 31);
    expect(world.hero.pos.x).toBeLessThan(4.5);

    step(world, []);
    expect(world.hero.pos).toEqual({ x: 4.5, y: 1.5 });

    step(world, []);
    expect(world.hero.pos).toEqual({ x: 4.5, y: 1.5 });
  });

  // A 3-4-5 diagonal: 5 / 5.5 s = 54.5 steps, so 55.
  it("walks diagonally in a straight line", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });

    step(world, [{ type: "MoveTo", target: { x: 4.5, y: 5.5 } }]);
    stepTimes(world, 26);
    const { x, y } = world.hero.pos;
    expect((y - 1.5) / (x - 1.5)).toBeCloseTo(4 / 3);

    stepTimes(world, 27);
    expect(world.hero.pos).not.toEqual({ x: 4.5, y: 5.5 });
    step(world, []);
    expect(world.hero.pos).toEqual({ x: 4.5, y: 5.5 });
  });

  it("ignores a target with no floor", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });

    step(world, [{ type: "MoveTo", target: { x: 6.5, y: 6.5 } }]);
    step(world, [{ type: "MoveTo", target: { x: 9, y: 1.5 } }]);
    step(world, [{ type: "MoveTo", target: { x: -0.1, y: 1.5 } }]);

    expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });
  });

  it("re-targets mid-walk", () => {
    const world = createWorld({ areas: { town: openFloor() }, seed: 1 });

    step(world, [{ type: "MoveTo", target: { x: 4.5, y: 1.5 } }]);
    stepTimes(world, 10);
    step(world, [{ type: "MoveTo", target: { x: 1.5, y: 1.5 } }]);
    stepTimes(world, 11);

    expect(world.hero.pos).toEqual({ x: 1.5, y: 1.5 });
  });
});
