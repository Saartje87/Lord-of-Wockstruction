import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";
import type { Placed } from "../sim/area";
import { wallMeshesOf } from "./wallMeshes";

function piece() {
  const group = new Group();
  group.add(new Mesh(new BoxGeometry(4, 4, 1), new MeshBasicMaterial()));
  return group;
}

const PIECES: Record<string, Group> = {
  "dungeon/wall": piece(),
  "dungeon/wall_corner": piece(),
  "dungeon/wall_Tsplit": piece(),
  "dungeon/wall_crossing": piece(),
  "dungeon/wall_endcap": piece(),
};

const wallAt = (x: number, y: number): Placed => ({
  x,
  y,
  piece: "dungeon/wall",
  blocks: true,
});

/** How tall the instance `i` of `mesh` stands in the scene. */
function heightOf(mesh: InstancedMesh, i: number): number {
  const matrix = new Matrix4();
  mesh.getMatrixAt(i, matrix);
  const size = new Vector3().setFromMatrixScale(matrix);
  return size.y;
}

function instancesOf(group: Group): InstancedMesh[] {
  return group.children.filter(
    (child): child is InstancedMesh => child instanceof InstancedMesh,
  );
}

describe("the 3D World's Walls", () => {
  it("is instanced: one draw for a run of Walls, one per joint piece", () => {
    const walls = [wallAt(0, 0), wallAt(1, 0), wallAt(2, 0), wallAt(2, 1)];

    const { group } = wallMeshesOf(walls, PIECES);

    // (2, 0) is a corner, (0, 0) and (2, 1) end the run, (1, 0) is straight.
    const counts = Object.fromEntries(
      instancesOf(group).map((mesh) => [mesh.userData.piece, mesh.count]),
    );
    expect(counts).toEqual({
      "dungeon/wall": 1,
      "dungeon/wall_corner": 1,
      "dungeon/wall_endcap": 2,
    });
  });

  it("stands the lowered Walls down to stubs, and back up", () => {
    const walls = [wallAt(0, 0), wallAt(1, 0)];
    const { group, lower } = wallMeshesOf(walls, PIECES);
    const [mesh] = instancesOf(group);
    const standing = heightOf(mesh, 1);

    lower([1]);

    expect(heightOf(mesh, 0)).toBeCloseTo(standing);
    expect(heightOf(mesh, 1)).toBeLessThan(standing / 4);

    lower([]);

    expect(heightOf(mesh, 1)).toBeCloseTo(standing);
  });
});
