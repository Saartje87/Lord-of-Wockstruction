// Bone Altar drawing: a stack of stone, bone and a red ember, built from
// primitives, one group per altar standing, redder as it is worn down.

import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SphereGeometry,
} from "three";
import type { Vec } from "../sim/vec";

/** How tall a Bone Altar is drawn, in tiles; also its height for picking. */
export const BONE_ALTAR_HEIGHT = 1.1;

/** A Bone Altar as the 3D World shows it. */
export type BoneAltarView = {
  id: number;
  pos: Vec;
  /** How much of its Life it has left, 0..1. */
  fraction: number;
};

/** The Bone Altars in the scene. */
export type BoneAltarMeshes = {
  group: Group;
  /** Shows `altars` standing, and removes the ones no longer there. */
  show: (altars: readonly BoneAltarView[], seconds: number) => void;
};

const STONE = new MeshLambertMaterial({ color: 0x4a4540 });
const BONE = new MeshLambertMaterial({ color: 0xd9d2b8 });
const BASE = new CylinderGeometry(0.5, 0.56, 0.3, 8);
const COLUMN = new CylinderGeometry(0.26, 0.38, 0.5, 6);
const SPIKE = new ConeGeometry(0.22, 0.45, 5);
const EMBER = new SphereGeometry(0.13, 8, 6);
const WORN = new Color(0xff2a1a);
const FRESH = new Color(0xe2a03d);

/** One altar: stone base, bone column and spike, and an ember on top. */
function altarOf(): { root: Group; ember: MeshBasicMaterial } {
  const root = new Group();
  const base = new Mesh(BASE, STONE);
  base.position.y = 0.15;
  const column = new Mesh(COLUMN, BONE);
  column.position.y = 0.55;
  const spike = new Mesh(SPIKE, BONE);
  spike.position.y = 0.97;
  const ember = new MeshBasicMaterial({ color: FRESH });
  const glow = new Mesh(EMBER, ember);
  glow.position.y = 1.0;
  root.add(base, column, spike, glow);
  return { root, ember };
}

/** An empty set of Bone Altar meshes. */
export function boneAltarMeshesOf(): BoneAltarMeshes {
  const group = new Group();
  const standing = new Map<number, ReturnType<typeof altarOf>>();
  return {
    group,
    show(altars, seconds) {
      const seen = new Set<number>();
      for (const altar of altars) {
        seen.add(altar.id);
        let mesh = standing.get(altar.id);
        if (!mesh) {
          mesh = altarOf();
          standing.set(altar.id, mesh);
          group.add(mesh.root);
        }
        mesh.root.position.set(altar.pos.x, 0, altar.pos.y);
        mesh.ember.color.copy(WORN).lerp(FRESH, altar.fraction);
        const pulse = 1 + 0.15 * Math.sin(seconds * 3 + altar.id);
        mesh.root.children[3].scale.setScalar(pulse);
      }
      for (const [id, mesh] of standing) {
        if (seen.has(id)) continue;
        group.remove(mesh.root);
        mesh.ember.dispose();
        standing.delete(id);
      }
    },
  };
}
