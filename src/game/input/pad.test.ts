import { describe, expect, it } from "vitest";
import type { Vec } from "../sim/vec";
import { inputTuning } from "../tuning/input";
import { createPadInput, type PadSnapshot, pollPad } from "./pad";

// Treat canvas points as tile units, so tests can speak in tiles.
const asTiles = { toTile: (screen: Vec) => screen };

/** A snapshot with the stick at `stick` and no button down. */
const stickAt = (stick: Vec): PadSnapshot => ({
  stick,
  pressed: [],
  held: [],
  released: [],
});

describe("pad input", () => {
  it("orders a walk in the direction the stick points", () => {
    const input = createPadInput();

    const { orders } = pollPad(input, stickAt({ x: 0.6, y: -0.8 }), 0, asTiles);

    expect(orders).toEqual([{ type: "Walk", direction: { x: 0.6, y: -0.8 } }]);
  });

  it("orders the walk again every frame the stick is held", () => {
    const input = createPadInput();
    pollPad(input, stickAt({ x: 1, y: 0 }), 0, asTiles);

    const { orders } = pollPad(input, stickAt({ x: 1, y: 0 }), 16, asTiles);

    expect(orders).toEqual([{ type: "Walk", direction: { x: 1, y: 0 } }]);
  });

  it("orders nothing with the stick let go", () => {
    const input = createPadInput();
    pollPad(input, stickAt({ x: 1, y: 0 }), 0, asTiles);

    const { orders } = pollPad(input, stickAt({ x: 0, y: 0 }), 16, asTiles);

    expect(orders).toEqual([]);
  });

  it("orders nothing inside the dead zone, and walks just past it", () => {
    const input = createPadInput();
    const edge = inputTuning.stickDeadZone;

    const inside = pollPad(input, stickAt({ x: 0, y: edge * 0.9 }), 0, asTiles);
    expect(inside.orders).toEqual([]);
    const diagonal = { x: edge * 0.6, y: edge * 0.6 };
    expect(pollPad(input, stickAt(diagonal), 0, asTiles).orders).toEqual([]);

    const past = pollPad(input, stickAt({ x: 0, y: edge * 1.1 }), 0, asTiles);
    expect(past.orders).toEqual([
      { type: "Walk", direction: { x: 0, y: edge * 1.1 } },
    ]);
  });

  // On screen, up the stick is up the screen; the view turns that into the
  // World's tiles, as an isometric view would.
  it("walks the way the stick points on screen, in tiles", () => {
    const input = createPadInput();
    const turned = {
      toTile: (screen: Vec) => ({
        x: 10 + screen.x + screen.y,
        y: 4 + screen.y - screen.x,
      }),
    };

    const { orders } = pollPad(input, stickAt({ x: 0, y: -1 }), 0, turned);

    expect(orders).toEqual([{ type: "Walk", direction: { x: -1, y: -1 } }]);
  });
});
