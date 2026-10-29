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
import { propMeshesOf } from "./propMeshes";

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
