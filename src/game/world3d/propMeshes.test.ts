import {
  BoxGeometry,
  Group,
  type InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";
import type { Placed } from "../sim/area";
import { propMeshesOf, scaleOf } from "./propMeshes";

function piece() {
  const group = new Group();
  group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
  return group;
}

const propAt = (x: number, y: number, name: string): Placed => ({
  x,
  y,
  piece: name,
  blocks: true,
});

describe("the size of Town's Props", () => {
  // The Hero stands 0.9 of a tile tall.
  const HERO = 0.9;
  const heights: Record<string, number> = {
    "halloween/tree_dead_large": 4.8,
    "halloween/lantern_standing": 0.93,
    "hexagon/building_tavern_red": 1.4,
    "hexagon/building_home_B_blue": 1.28,
    "halloween/crypt": 8,
  };

  it("draws trees, houses and the crypt taller than the Hero", () => {
    for (const piece of [
      "halloween/tree_dead_large",
      "hexagon/building_tavern_red",
      "hexagon/building_home_B_blue",
      "halloween/crypt",
    ]) {
      expect(heights[piece] * scaleOf(piece)).toBeGreaterThan(HERO * 1.8);
    }
  });

  it("draws a standing lantern about as tall as the Hero's waist", () => {
    const lantern =
      heights["halloween/lantern_standing"] *
      scaleOf("halloween/lantern_standing");
    expect(lantern).toBeGreaterThan(HERO * 0.5);
    expect(lantern).toBeLessThan(HERO * 1.1);
  });

  it("draws a house about two tiles wide", () => {
    expect(0.88 * scaleOf("hexagon/building_home_B_blue")).toBeGreaterThan(1.6);
    expect(0.88 * scaleOf("hexagon/building_home_B_blue")).toBeLessThan(2.4);
  });
});

describe("the 3D World's Props", () => {
  it("draws each Prop from its piece, instanced per piece, on its cell", () => {
    const props = [
      propAt(2, 3, "dungeon/barrel_large"),
      propAt(4, 1, "dungeon/barrel_large"),
      propAt(5, 5, "dungeon/chest"),
    ];

    const group = propMeshesOf(props, {
      "dungeon/barrel_large": piece(),
      "dungeon/chest": piece(),
    });

    const meshes = group.children as InstancedMesh[];
    expect(meshes.map((m) => [m.userData.piece, m.count])).toEqual([
      ["dungeon/barrel_large", 2],
      ["dungeon/chest", 1],
    ]);
    const matrix = new Matrix4();
    meshes[0].getMatrixAt(0, matrix);
    const at = new Vector3().setFromMatrixPosition(matrix);
    expect([at.x, at.y, at.z]).toEqual([2.5, 0, 3.5]);
  });

  it("skips a Prop whose piece isn't loaded", () => {
    const group = propMeshesOf([propAt(1, 1, "dungeon/unknown")], {});

    expect(group.children).toHaveLength(0);
  });
});
