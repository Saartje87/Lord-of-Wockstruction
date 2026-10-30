import { describe, expect, it } from "vitest";
import type { Placed } from "../sim/area";
import { wallPlacementsOf } from "./walls";

type Cell = [number, number];

const wallAt = (x: number, y: number, piece = "dungeon/wall"): Placed => ({
  x,
  y,
  piece,
  blocks: true,
});

/** How the Wall at `at` is drawn among `others`, e.g. "wall_corner@1". */
function drawnAt(at: Cell, others: Cell[], piece = "dungeon/wall"): string[] {
  const walls = [at, ...others].map(([x, y]) => wallAt(x, y, piece));
  return wallPlacementsOf(walls)
    .filter((p) => p.wall === 0)
    .map((p) => `${p.piece.replace("dungeon/", "")}@${p.turn}`);
}

describe("a Wall's direction and corners", () => {
  it("runs along x for a Wall with neighbours along x", () => {
    expect(
      drawnAt(
        [1, 0],
        [
          [0, 0],
          [2, 0],
        ],
      ),
    ).toEqual(["wall@0"]);
  });

  it("runs along y for a Wall with neighbours along y, turned a quarter", () => {
    expect(
      drawnAt(
        [0, 1],
        [
          [0, 0],
          [0, 2],
        ],
      ),
    ).toEqual(["wall@1"]);
  });

  it("runs along x for a lone Wall", () => {
    expect(drawnAt([5, 5], [])).toEqual(["wall@0"]);
  });

  it("ends a run with an end piece pointing at its one neighbour", () => {
    // The end piece reaches east from the cell's centre when turned 0.
    expect(drawnAt([1, 1], [[2, 1]])).toEqual(["wall_endcap@0"]);
    expect(drawnAt([1, 1], [[1, 2]])).toEqual(["wall_endcap@3"]);
    expect(drawnAt([1, 1], [[0, 1]])).toEqual(["wall_endcap@2"]);
    expect(drawnAt([1, 1], [[1, 0]])).toEqual(["wall_endcap@1"]);
  });

  it("has no end piece for a Wall piece without joints", () => {
    expect(drawnAt([1, 1], [[2, 1]], "halloween/fence")).toEqual([
      "halloween/fence@0",
    ]);
  });

  it("is a corner where a run along x meets one along y", () => {
    // The corner piece joins west and south (tile -x and +y) turned 0; each
    // quarter turn moves its arms on: west to south to east to north.
    expect(
      drawnAt(
        [1, 1],
        [
          [0, 1],
          [1, 2],
        ],
      ),
    ).toEqual(["wall_corner@0"]);
    expect(
      drawnAt(
        [1, 1],
        [
          [1, 2],
          [2, 1],
        ],
      ),
    ).toEqual(["wall_corner@1"]);
    expect(
      drawnAt(
        [1, 1],
        [
          [2, 1],
          [1, 0],
        ],
      ),
    ).toEqual(["wall_corner@2"]);
    expect(
      drawnAt(
        [1, 1],
        [
          [1, 0],
          [0, 1],
        ],
      ),
    ).toEqual(["wall_corner@3"]);
  });

  it("is a T where a run meets the side of another", () => {
    expect(
      drawnAt(
        [1, 1],
        [
          [0, 1],
          [2, 1],
          [1, 2],
        ],
      ),
    ).toEqual(["wall_Tsplit@0"]);
    expect(
      drawnAt(
        [1, 1],
        [
          [0, 1],
          [2, 1],
          [1, 0],
        ],
      ),
    ).toEqual(["wall_Tsplit@2"]);
  });

  it("is a crossing where two runs cross", () => {
    expect(
      drawnAt(
        [1, 1],
        [
          [0, 1],
          [2, 1],
          [1, 0],
          [1, 2],
        ],
      ),
    ).toEqual(["wall_crossing@0"]);
  });

  it("draws a Wall whose piece has no corners as straight pieces both ways", () => {
    expect(
      drawnAt(
        [1, 1],
        [
          [0, 1],
          [1, 2],
        ],
        "halloween/fence",
      ),
    ).toEqual(["halloween/fence@0", "halloween/fence@1"]);
  });
});
