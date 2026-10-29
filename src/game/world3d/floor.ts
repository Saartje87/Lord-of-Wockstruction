import {
  Group,
  InstancedMesh,
  Matrix4,
  type Mesh,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";
import type { Area } from "../sim/area";

/**
 * KayKit's large floor piece is 4 units across; at this scale one covers one
 * tile (one scene unit).
 */
export const PIECE_SCALE = 0.25;

/** The floor pieces an Area's floor is made of. */
export type FloorPieces = {
  /** The plain 4×4 piece most cells get. */
  plain: Object3D;
  /** A cracked 2×2 piece, scaled up to a tile. */
  broken: Object3D;
  /** A 4×4 piece of bare dirt. */
  dirt: Object3D;
};

/** A steady 0..1 for a cell and a salt, so an Area always looks the same. */
function hash(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The Area's floor: one instanced piece on each floor cell, a few cracked or
 * bare, each turned a quarter at random. One draw per mesh of a piece, not
 * per cell.
 */
export function floorOf(area: Area, pieces: FloorPieces): Group {
  const cells: Record<keyof FloorPieces, Matrix4[]> = {
    plain: [],
    broken: [],
    dirt: [],
  };
  const up = new Vector3(0, 1, 0);
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      if (!area.floor[y * area.width + x]) continue;
      const pick = hash(x, y, 1);
      const kind = pick < 0.08 ? "broken" : pick < 0.16 ? "dirt" : "plain";
      const turn = Math.floor(hash(x, y, 2) * 4) * (Math.PI / 2);
      // The broken piece is 2×2 natively, so it's drawn twice the scale.
      const scale = kind === "broken" ? PIECE_SCALE * 2 : PIECE_SCALE;
      cells[kind].push(
        new Matrix4().compose(
          new Vector3(x + 0.5, 0, y + 0.5),
          new Quaternion().setFromAxisAngle(up, turn),
          new Vector3(scale, scale, scale),
        ),
      );
    }
  }
  const floor = new Group();
  for (const kind of Object.keys(cells) as (keyof FloorPieces)[]) {
    floor.add(...instanced(pieces[kind], cells[kind]));
  }
  return floor;
}

/**
 * One InstancedMesh for each mesh of `model`, with an instance at each of
 * `placements`.
 */
function instanced(model: Object3D, placements: Matrix4[]): InstancedMesh[] {
  if (placements.length === 0) return [];
  model.updateMatrixWorld(true);
  const meshes: InstancedMesh[] = [];
  model.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const instances = new InstancedMesh(
      mesh.geometry,
      mesh.material,
      placements.length,
    );
    placements.forEach((placement, i) => {
      instances.setMatrixAt(i, placement.clone().multiply(mesh.matrixWorld));
    });
    instances.instanceMatrix.needsUpdate = true;
    // The bounds are one piece's, so three.js would cull the far ones.
    instances.frustumCulled = false;
    meshes.push(instances);
  });
  return meshes;
}
