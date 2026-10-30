// Bone Wall drawing: a low plinth with a row of bone spikes per piece, built
// from primitives like the Bone Altar. A piece's spikes shorten as it is worn
// down and sink into the floor as it crumbles.

import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
} from "three";
import type { Vec } from "../sim/vec";

/** A Bone Wall piece as the 3D World shows it. */
export type BoneWallView = {
  /** Its tile's index: unique among the pieces standing. */
  id: number;
  pos: Vec;
  /** How much of its Life it has left, 0..1. */
  fraction: number;
  /** How far it has sunk as it crumbles, 0 (standing) to 1 (gone). */
  sunk: number;
};

/** The Bone Wall pieces in the scene. */
export type BoneWallMeshes = {
  group: Group;
  /** Shows `pieces` standing, and removes the ones no longer there. */
  show: (pieces: readonly BoneWallView[]) => void;
};

/** How tall a piece's spikes stand, in tiles. */
const SPIKE_HEIGHT = 0.9;

const PLINTH = new MeshLambertMaterial({ color: 0xb9b199 });
const BONE = new MeshLambertMaterial({ color: 0xe6dfc6 });
const BASE = new BoxGeometry(0.96, 0.18, 0.5);
const SPIKE = new ConeGeometry(0.13, SPIKE_HEIGHT, 5);
/** Where along the piece (x) and how tall (scale) each spike stands. */
const SPIKES = [
  { x: -0.32, height: 0.8 },
  { x: -0.1, height: 1 },
  { x: 0.12, height: 0.85 },
  { x: 0.34, height: 0.7 },
];

/** One piece: a plinth with a row of spikes across the line of the Wall. */
function pieceOf(): { root: Group; spikes: Mesh[] } {
  const root = new Group();
  const base = new Mesh(BASE, PLINTH);
  base.position.y = 0.09;
  root.add(base);
  const spikes = SPIKES.map(({ x }) => {
    const spike = new Mesh(SPIKE, BONE);
    spike.position.x = x;
    root.add(spike);
    return spike;
  });
  return { root, spikes };
}

/** An empty set of Bone Wall meshes. */
export function boneWallMeshesOf(): BoneWallMeshes {
  const group = new Group();
  const standing = new Map<number, ReturnType<typeof pieceOf>>();
  return {
    group,
    show(pieces) {
      const seen = new Set<number>();
      for (const piece of pieces) {
        seen.add(piece.id);
        let mesh = standing.get(piece.id);
        if (!mesh) {
          mesh = pieceOf();
          standing.set(piece.id, mesh);
          group.add(mesh.root);
        }
        mesh.root.position.set(piece.pos.x, -piece.sunk * 1.1, piece.pos.y);
        const worn = 0.4 + 0.6 * piece.fraction;
        mesh.spikes.forEach((spike, i) => {
          const height = SPIKES[i].height * worn;
          spike.scale.y = height;
          spike.position.y = 0.18 + (SPIKE_HEIGHT * height) / 2;
        });
      }
      for (const [id, mesh] of standing) {
        if (seen.has(id)) continue;
        group.remove(mesh.root);
        standing.delete(id);
      }
    },
  };
}
