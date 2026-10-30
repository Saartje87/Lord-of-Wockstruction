import type { BufferGeometry, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { arenaWith } from "../input/testArena";
import type { Area } from "../sim/area";
import { pondsOf, WATER_LOOK, waterMeshesOf } from "./waterMeshes";

/** The 20×20 test Area with Water on `tiles`. */
function areaWithWater(tiles: [number, number][]): Area {
  const world = arenaWith([]);
  const base = world.areas[world.areaName];
  const water = base.water.map(() => false);
  for (const [x, y] of tiles) water[y * base.width + x] = true;
  return { ...base, water };
}

describe("the 3D World's ponds", () => {
  it("groups Water tiles that touch along an edge into one pond", () => {
    const area = areaWithWater([
      [2, 2],
      [3, 2],
      [3, 3],
      [10, 10],
      // Only a corner away from (3, 3): a pond of its own.
      [4, 4],
    ]);

    const ponds = pondsOf(area);

    expect(ponds.map((pond) => pond.tiles.length).sort()).toEqual([1, 1, 3]);
  });

  it("has no pond in an Area without Water", () => {
    expect(pondsOf(areaWithWater([]))).toEqual([]);
    expect(waterMeshesOf(areaWithWater([])).group.children).toEqual([]);
  });

  it("draws one flat plane per pond, just below the floor's top", () => {
    const area = areaWithWater([
      [2, 2],
      [3, 2],
      [10, 10],
    ]);

    const { group } = waterMeshesOf(area);

    expect(group.children).toHaveLength(2);
    for (const child of group.children) {
      const geometry = (child as Mesh).geometry as BufferGeometry;
      const heights = new Set<number>();
      const positions = geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) heights.add(positions.getY(i));
      expect(heights.size).toBe(1);
      expect([...heights][0]).toBeCloseTo(-WATER_LOOK.depth);
    }
    const sizes = (group.children as Mesh[])
      .map((child) => child.geometry.getAttribute("position").count)
      .sort();
    // A square of four corners for each tile.
    expect(sizes).toEqual([4, 8]);
  });

  it("shimmers: its colour changes with time", () => {
    const { group, update } = waterMeshesOf(areaWithWater([[2, 2]]));
    const material = (group.children[0] as Mesh).material as MeshBasicMaterial;

    update(0);
    const a = material.color.getHex();
    update(WATER_LOOK.shimmerSeconds / 4);
    const b = material.color.getHex();

    expect(a).not.toBe(b);
  });
});
