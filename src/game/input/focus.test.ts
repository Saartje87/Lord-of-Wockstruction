import { describe, expect, it } from "vitest";
import type { Rect } from "../sim/rect";
import { moveFocus } from "./focus";

/** A spot named `name`, `w`×`h` with its top-left at `x`, `y`. */
const spot = (name: string, x: number, y: number, w = 1, h = 1) => ({
  name,
  rect: { x, y, w, h } satisfies Rect,
});

/** A 3×2 grid of unit cells, named by column and row. */
const grid = [0, 1].flatMap((row) =>
  [0, 1, 2].map((column) => spot(`${column},${row}`, column, row)),
);
const at = (name: string) =>
  grid.find((cell) => cell.name === name) as (typeof grid)[number];

describe("moving the Focus", () => {
  it.each([
    ["right", "2,0"],
    ["left", "0,0"],
    ["down", "1,1"],
  ] as const)("goes %s to the next cell in a grid", (direction, to) => {
    expect(moveFocus(grid, at("1,0"), direction).name).toBe(to);
  });

  it("stays put with nothing that way", () => {
    expect(moveFocus(grid, at("1,0"), "up").name).toBe("1,0");
    expect(moveFocus(grid, at("2,1"), "right").name).toBe("2,1");
  });

  it("goes to the spot in line before a nearer one off to the side", () => {
    const spots = [
      spot("from", 0, 0),
      spot("aside", 1, 2),
      spot("inLine", 3, 0),
    ];

    expect(moveFocus(spots, spots[0], "right").name).toBe("inLine");
  });

  it("passes over a spot that doesn't lie past its edge", () => {
    const from = spot("from", 0, 2);
    const overlapping = spot("overlapping", 0.6, 0, 0.6, 0.6);

    expect(moveFocus([from, overlapping], from, "right").name).toBe("from");
  });

  it("goes from a tall spot to the one level with its middle", () => {
    const tall = spot("tall", 0, 0, 2, 4);
    const top = spot("top", 3, 0);
    const middle = spot("middle", 3, 1.5);

    expect(moveFocus([tall, top, middle], tall, "right").name).toBe("middle");
  });

  it("goes from a wide spot down to the one under its middle", () => {
    const wide = spot("wide", 0, 0, 3, 1);
    const cells = [0, 1, 2].map((column) => spot(`${column}`, column, 2));

    expect(moveFocus([wide, ...cells], wide, "down").name).toBe("1");
  });
});
