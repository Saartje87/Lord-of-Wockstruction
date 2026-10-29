import { describe, expect, it } from "vitest";
import { arenaWith } from "../input/testArena";
import type { Area, Placed } from "../sim/area";
import { torchesOf } from "./torches";

/**
 * A 20×20 Area whose cells `isFloor` rejects are void, with Walls on the
 * cells that `isWall` accepts.
 */
function areaWith(
  isFloor: (x: number, y: number) => boolean,
  isWall: (x: number, y: number) => boolean,
): Area {
  const world = arenaWith([], { combat: true });
  const area = world.areas[world.areaName];
  const walls: Placed[] = [];
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      area.floor[y * area.width + x] = isFloor(x, y);
      if (isWall(x, y)) {
        walls.push({ x, y, piece: "dungeon/wall", blocks: true });
      }
    }
  }
  area.walls = walls;
  return area;
}

/** A Wall along x at y = 5 with floor south of it (on the camera's side). */
const southFacing = () =>
  areaWith(
    (_, y) => y > 5,
    (_, y) => y === 5,
  );

describe("where the Walls carry torches", () => {
  it("mounts torches on Walls that face the camera, with floor in front", () => {
    const area = southFacing();

    const torches = torchesOf(area);

    expect(torches.length).toBeGreaterThan(0);
    for (const torch of torches) {
      expect(area.walls[torch.wall].y).toBe(5);
      // Out on the floor side of the Wall, whose middle is at y 5.5.
      expect(torch.pos.y).toBeGreaterThan(5.5);
      expect(torch.pos.x).toBeCloseTo(area.walls[torch.wall].x + 0.5);
    }
  });

  it("mounts torches on the +x face of Walls along y too", () => {
    const area = areaWith(
      (x) => x > 5,
      (x) => x === 5,
    );

    const torches = torchesOf(area);

    expect(torches.length).toBeGreaterThan(0);
    for (const torch of torches) expect(torch.pos.x).toBeGreaterThan(5.5);
  });

  it("leaves Walls that face away from the camera bare", () => {
    const area = areaWith(
      (_, y) => y < 5,
      (_, y) => y === 5,
    );

    expect(torchesOf(area)).toEqual([]);
  });

  it("spaces torches apart", () => {
    const torches = torchesOf(southFacing());

    for (const a of torches) {
      for (const b of torches) {
        if (a === b) continue;
        const apart = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
        expect(apart).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("puts the same torches in an Area every time", () => {
    expect(torchesOf(southFacing())).toEqual(torchesOf(southFacing()));
  });

  it("puts none on Walls that aren't dungeon stone", () => {
    const area = southFacing();
    for (const wall of area.walls) wall.piece = "halloween/fence";

    expect(torchesOf(area)).toEqual([]);
  });
});
