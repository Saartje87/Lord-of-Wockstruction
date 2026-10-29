import {
  Group,
  InstancedMesh,
  Matrix4,
  type Mesh,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";
import type { Placed } from "../sim/area";
import { PIECE_SCALE } from "./floor";
import { wallPlacementsOf } from "./walls";

/**
 * Walls stand taller than KayKit's pieces at tile scale (a tile high): a
 * crypt feel, and enough to hide the floor behind them.
 */
const HEIGHT_STRETCH = 1.28;

/** How much of its height a lowered Wall keeps: a stub. */
const STUB = 0.12;

/** The Walls of an Area as the scene holds them. */
export type WallMeshes = {
  group: Group;
  /**
   * Stands the Walls at these indices of the Area's `walls` down to stubs
   * and every other one up. Cheap when nothing changed since the last call.
   */
  lower: (walls: readonly number[]) => void;
};

/** One piece of a Wall in an instanced mesh. */
type Instance = {
  mesh: InstancedMesh;
  at: number;
  wall: number;
  standing: Matrix4;
  lowered: Matrix4;
};

/**
 * The Walls of an Area, instanced: one InstancedMesh per mesh of each
 * piece in use. Which piece goes where comes from the Walls' neighbours
 * (`wallPlacementsOf`); `pieces` holds the models by piece name.
 */
export function wallMeshesOf(
  walls: Placed[],
  pieces: Record<string, Object3D | undefined>,
): WallMeshes {
  const up = new Vector3(0, 1, 0);
  const byPiece = new Map<string, { wall: number; turn: number }[]>();
  for (const { wall, piece, turn } of wallPlacementsOf(walls)) {
    if (!pieces[piece]) continue;
    byPiece.set(piece, [...(byPiece.get(piece) ?? []), { wall, turn }]);
  }

  const group = new Group();
  const instances: Instance[] = [];
  const pose = (wall: Placed, turn: number, stretch: number) =>
    new Matrix4().compose(
      new Vector3(wall.x + 0.5, 0, wall.y + 0.5),
      new Quaternion().setFromAxisAngle(up, turn * (Math.PI / 2)),
      new Vector3(PIECE_SCALE, PIECE_SCALE * stretch, PIECE_SCALE),
    );

  for (const [name, placed] of byPiece) {
    const model = pieces[name] as Object3D;
    model.updateMatrixWorld(true);
    model.traverse((node) => {
      const source = node as Mesh;
      if (!source.isMesh) return;
      const mesh = new InstancedMesh(
        source.geometry,
        source.material,
        placed.length,
      );
      mesh.userData.piece = name;
      // The Walls span the Area, and a mesh's bounds are one piece's.
      mesh.frustumCulled = false;
      placed.forEach(({ wall, turn }, at) => {
        const standing = pose(walls[wall], turn, HEIGHT_STRETCH).multiply(
          source.matrixWorld,
        );
        const lowered = pose(walls[wall], turn, HEIGHT_STRETCH * STUB).multiply(
          source.matrixWorld,
        );
        mesh.setMatrixAt(at, standing);
        instances.push({ mesh, at, wall, standing, lowered });
      });
      group.add(mesh);
    });
  }

  let lowered = new Set<number>();
  return {
    group,
    lower(indices) {
      const next = new Set(indices);
      const touched = new Set<InstancedMesh>();
      for (const instance of instances) {
        if (lowered.has(instance.wall) === next.has(instance.wall)) continue;
        instance.mesh.setMatrixAt(
          instance.at,
          next.has(instance.wall) ? instance.lowered : instance.standing,
        );
        touched.add(instance.mesh);
      }
      for (const mesh of touched) mesh.instanceMatrix.needsUpdate = true;
      lowered = next;
    },
  };
}
