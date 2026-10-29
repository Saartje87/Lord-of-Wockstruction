import {
  Box3,
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

/** The floor is drawn in blocks this many tiles square, culled by block. */
const CHUNK = 12;

/** The loaded floor pieces, by KayKit piece name (`dungeon/floor_tile_large`). */
export type FloorPieces = Record<string, Object3D>;

/**
 * The dungeon pieces an Area gets a mix of when its floor doesn't name them:
 * the plain 4×4 piece most cells get, a cracked one and one of bare dirt.
 */
export const FLOOR_MIX = {
  plain: "dungeon/floor_tile_large",
  broken: "dungeon/floor_tile_small_broken_A",
  dirt: "dungeon/floor_dirt_large",
};

/** Town's floor: bare Halloween dirt, crossed by four kinds of path. */
export const TOWN_FLOOR = [
  "halloween/floor_dirt",
  "halloween/path_A",
  "halloween/path_B",
  "halloween/path_C",
  "halloween/path_D",
];

/** The scale at which `piece` covers one tile: pieces differ in size. */
function fitOf(piece: Object3D): number {
  const size = new Box3().setFromObject(piece).getSize(new Vector3());
  return 1 / Math.max(size.x, size.z);
}

/** A steady 0..1 for a cell and a salt, so an Area always looks the same. */
export function hash(x: number, y: number, salt: number): number {
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
  const cells = new Map<string, Matrix4[]>();
  const fits = new Map<string, number>();
  const up = new Vector3(0, 1, 0);
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      if (!area.floor[y * area.width + x]) continue;
      const named = area.floorPieces[y * area.width + x] ?? "";
      const pick = hash(x, y, 1);
      const name =
        named && pieces[named]
          ? named
          : pick < 0.08
            ? FLOOR_MIX.broken
            : pick < 0.16
              ? FLOOR_MIX.dirt
              : FLOOR_MIX.plain;
      if (!pieces[name]) continue;
      let scale = fits.get(name);
      if (scale === undefined) {
        scale = fitOf(pieces[name]);
        fits.set(name, scale);
      }
      const turn = Math.floor(hash(x, y, 2) * 4) * (Math.PI / 2);
      const placements = cells.get(name) ?? [];
      placements.push(
        new Matrix4().compose(
          new Vector3(x + 0.5, 0, y + 0.5),
          new Quaternion().setFromAxisAngle(up, turn),
          new Vector3(scale, scale, scale),
        ),
      );
      cells.set(name, placements);
    }
  }
  const floor = new Group();
  for (const [name, placements] of cells) {
    floor.add(...instanced(pieces[name], placements));
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
  // Each block of cells is its own mesh, so three.js culls the ones off screen.
  const blocks = new Map<string, Matrix4[]>();
  for (const placement of placements) {
    const key = `${Math.floor(placement.elements[12] / CHUNK)},${Math.floor(placement.elements[14] / CHUNK)}`;
    blocks.set(key, [...(blocks.get(key) ?? []), placement]);
  }
  const meshes: InstancedMesh[] = [];
  model.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    for (const block of blocks.values()) {
      const instances = new InstancedMesh(
        mesh.geometry,
        mesh.material,
        block.length,
      );
      block.forEach((placement, i) => {
        instances.setMatrixAt(i, placement.clone().multiply(mesh.matrixWorld));
      });
      instances.instanceMatrix.needsUpdate = true;
      meshes.push(instances);
    }
  });
  return meshes;
}
