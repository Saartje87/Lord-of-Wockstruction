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
import { hash, PIECE_SCALE } from "./floor";

/**
 * Pieces drawn at other than tile scale (a multiple of `PIECE_SCALE`): KayKit's
 * packs are drawn to different sizes, and next to a Knight 0.9 of a tile tall
 * some of Town's pieces want growing: Halloween Bits' trees, lanterns and
 * graves, and Medieval Hexagon's houses, which come at about a quarter of
 * the size of the other packs.
 */
export function scaleOf(piece: string): number {
  if (piece === "hexagon/building_well_red") return 1.6;
  if (piece.startsWith("hexagon/")) return 2.2;
  if (/barrel|chest|crates/.test(piece)) return PIECE_SCALE * 1.2;
  if (/tree_dead/.test(piece)) return PIECE_SCALE * 2;
  if (piece === "halloween/lantern_standing") return PIECE_SCALE * 2.4;
  if (piece === "halloween/crypt") return PIECE_SCALE * 1.2;
  if (/grave|gravestone|gravemarker/.test(piece)) return PIECE_SCALE * 1.5;
  if (/pumpkin/.test(piece)) return PIECE_SCALE * 2;
  if (/skull|bone/.test(piece)) return PIECE_SCALE * 1.2;
  return PIECE_SCALE;
}

/** Pieces that look the same from every side, so can be turned at random. */
const TURNABLE = /barrel|crates|rubble|candle|pumpkin|skull|bone/;

/**
 * The Props of an Area, instanced: one InstancedMesh per mesh of each piece
 * in use, standing on their cells. `pieces` holds the models by piece name;
 * a Prop whose piece isn't there isn't drawn.
 */
export function propMeshesOf(
  props: Placed[],
  pieces: Record<string, Object3D | undefined>,
): Group {
  const up = new Vector3(0, 1, 0);
  const byPiece = new Map<string, Placed[]>();
  for (const prop of props) {
    if (!pieces[prop.piece]) continue;
    byPiece.set(prop.piece, [...(byPiece.get(prop.piece) ?? []), prop]);
  }
  const group = new Group();
  for (const [name, placed] of byPiece) {
    const model = pieces[name] as Object3D;
    model.updateMatrixWorld(true);
    const scale = scaleOf(name);
    model.traverse((node) => {
      const source = node as Mesh;
      if (!source.isMesh) return;
      const mesh = new InstancedMesh(
        source.geometry,
        source.material,
        placed.length,
      );
      mesh.userData.piece = name;
      mesh.frustumCulled = false;
      placed.forEach((prop, i) => {
        const turn = TURNABLE.test(name)
          ? Math.floor(hash(prop.x, prop.y, 3) * 4) * (Math.PI / 2)
          : 0;
        mesh.setMatrixAt(
          i,
          new Matrix4()
            .compose(
              new Vector3(prop.x + 0.5, 0, prop.y + 0.5),
              new Quaternion().setFromAxisAngle(up, turn),
              new Vector3(scale, scale, scale),
            )
            .multiply(source.matrixWorld),
        );
      });
      group.add(mesh);
    });
  }
  return group;
}
