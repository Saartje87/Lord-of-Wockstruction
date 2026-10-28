import { describe, expect, it } from "vitest";
import type { Area } from "../sim/area";
import { MAP_OVERLAY, mapMarks, mapOffset } from "./mapMarks";

/**
 * An Area drawn row by row: `.` floor, `#` a wall on floor, and a space void.
 * Only the shape matters to the maps.
 */
function areaOf(rows: string[]): Area {
  const cells = [...rows.join("")];
  return {
    width: rows[0].length,
    height: rows.length,
    floor: cells.map((cell) => cell !== " "),
    walkable: cells.map((cell) => cell === "."),
  } as Area;
}

const HERO = { x: 1.5, y: 1.5 };

describe("mapMarks", () => {
  it("draws a wall line on each side of a floor tile that meets a wall", () => {
    const area = areaOf(["###", "#.#", "###"]);

    const { edges } = mapMarks({ area, heroAt: HERO });

    expect(edges).toHaveLength(4);
    expect(edges.every((edge) => edge.kind === "wall")).toBe(true);
    expect(edges).toContainEqual({
      from: { x: 1, y: 1 },
      to: { x: 2, y: 1 },
      kind: "wall",
    });
  });

  it("draws a floor line where floor meets void", () => {
    const area = areaOf(["   ", " . ", "   "]);

    const { edges } = mapMarks({ area, heroAt: HERO });

    expect(edges).toHaveLength(4);
    expect(edges.every((edge) => edge.kind === "floor")).toBe(true);
  });

  it("draws the edge of the Area as a floor line", () => {
    const area = areaOf(["."]);

    const { edges } = mapMarks({ area, heroAt: { x: 0.5, y: 0.5 } });

    expect(edges).toHaveLength(4);
    expect(edges.every((edge) => edge.kind === "floor")).toBe(true);
  });

  it("draws no line between two floor tiles", () => {
    const area = areaOf(["..", "  "]);

    const { edges } = mapMarks({ area, heroAt: HERO });

    // Each tile's three outer sides, none on the side they share.
    expect(edges).toHaveLength(6);
    expect(edges).not.toContainEqual(
      expect.objectContaining({ from: { x: 1, y: 0 }, to: { x: 1, y: 1 } }),
    );
  });

  it("draws no line round a wall with nothing walkable beside it", () => {
    const area = areaOf(["###", "###"]);

    expect(mapMarks({ area, heroAt: HERO }).edges).toEqual([]);
  });

  it("marks the Hero where they stand", () => {
    const area = areaOf(["..", ".."]);

    expect(mapMarks({ area, heroAt: { x: 0.25, y: 1.75 } }).hero).toEqual({
      x: 0.25,
      y: 1.75,
    });
  });
});

describe("mapOffset", () => {
  it("puts the Hero at the centre", () => {
    expect(mapOffset(HERO, HERO, MAP_OVERLAY.scale)).toEqual({ x: 0, y: 0 });
  });

  it("draws at the World's isometric angle, at the map scale", () => {
    const east = mapOffset({ x: 2.5, y: 1.5 }, HERO, MAP_OVERLAY.scale);
    const south = mapOffset({ x: 1.5, y: 2.5 }, HERO, MAP_OVERLAY.scale);

    // One tile is 192 by 96 on the World: east goes down and right.
    expect(east.x).toBeCloseTo(96 * MAP_OVERLAY.scale);
    expect(east.y).toBeCloseTo(48 * MAP_OVERLAY.scale);
    expect(south.x).toBeCloseTo(-96 * MAP_OVERLAY.scale);
    expect(south.y).toBeCloseTo(48 * MAP_OVERLAY.scale);
  });
});
