import type {
  BufferGeometry,
  Color,
  Mesh,
  Points,
  ShaderMaterial,
} from "three";
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

  it("is not tone-mapped, so ponds keep their colour", () => {
    const { group } = waterMeshesOf(areaWithWater([[2, 2]]));
    const material = (group.children[0] as Mesh).material as ShaderMaterial;

    expect(material.toneMapped).toBe(false);
  });

  it("is a deep, dark blue-green", () => {
    const { group } = waterMeshesOf(areaWithWater([[2, 2]]));
    const material = (group.children[0] as Mesh).material as ShaderMaterial;
    const colour = material.uniforms.uColour.value as Color;

    expect(colour.getHex()).toBe(WATER_LOOK.plain.colour);
    expect(colour.b).toBeGreaterThan(colour.r);
    expect(colour.g).toBeGreaterThan(colour.r);
    expect(colour.r + colour.g + colour.b).toBeLessThan(1.5);
  });

  it("drifts its light as the game goes on, leaving the base colour alone", () => {
    const { group, update } = waterMeshesOf(areaWithWater([[2, 2]]));
    const material = (group.children[0] as Mesh).material as ShaderMaterial;

    update(0);
    const a = material.uniforms.uTime.value;
    update(5);
    expect(material.uniforms.uTime.value).not.toBe(a);
    const colour = (material.uniforms.uColour.value as Color).getHex();
    update(7);
    expect((material.uniforms.uColour.value as Color).getHex()).toBe(colour);
  });

  it("shares one material between all ponds of an Area", () => {
    const { group } = waterMeshesOf(
      areaWithWater([
        [2, 2],
        [10, 10],
      ]),
    );
    const [a, b] = group.children as Mesh[];

    expect(a.material).toBe(b.material);
  });
});

describe("the 3D World's hot springs", () => {
  const hot = (tiles: [number, number][]) => ({
    ...areaWithWater(tiles),
    hotSprings: true,
  });
  const planes = (group: { children: unknown[] }) =>
    group.children.filter((child) => (child as Mesh).isMesh) as Mesh[];
  const steam = (group: { children: unknown[] }) =>
    group.children.filter((child) => (child as Points).isPoints) as Points[];
  const colourOf = (meshes: ReturnType<typeof waterMeshesOf>) =>
    (planes(meshes.group)[0].material as ShaderMaterial).uniforms.uColour
      .value as Color;

  it("tint the Water warm turquoise, unlike plain Water", () => {
    const plain = waterMeshesOf(areaWithWater([[2, 2]]));
    const springs = waterMeshesOf(hot([[2, 2]]));
    plain.update(0);
    springs.update(0);

    expect(colourOf(springs).getHex()).not.toBe(colourOf(plain).getHex());
    expect(colourOf(springs).g).toBeGreaterThan(colourOf(plain).g);
    expect(
      (planes(springs.group)[0].material as ShaderMaterial).toneMapped,
    ).toBe(false);
    expect(WATER_LOOK.hotSprings.colour).not.toBe(WATER_LOOK.plain.colour);
  });

  it("let a few faint wisps of steam rise, which plain Water does not", () => {
    expect(steam(waterMeshesOf(areaWithWater([[2, 2]])).group)).toEqual([]);

    const { group, update } = waterMeshesOf(hot([[2, 2]]));
    const [wisps] = steam(group);
    expect(wisps).toBeDefined();
    const positions = wisps.geometry.getAttribute("position");
    expect(positions.count).toBeGreaterThan(0);
    expect(positions.count).toBeLessThanOrEqual(40);
    update(0);
    const before = positions.getY(0);
    update(0.5);
    expect(positions.getY(0)).not.toBe(before);
  });

  it("have no steam without Water", () => {
    expect(waterMeshesOf(hot([])).group.children).toEqual([]);
  });
});
