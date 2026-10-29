import {
  Color,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type MeshToonMaterial,
  type Object3D,
  OctahedronGeometry,
  Quaternion,
  Vector3,
} from "three";
import { GEM, glowOf, type Placement } from "./lootLook";
import { LOOKS, outline, toonShade } from "./toon";

/** How many of one model can be on the floor or in flight at once. */
const CAPACITY = 96;

/** How much of its own colour a loot model glows, to stay seen in the dark. */
const LIFT = 0.07;

/** How much brighter than its tint a bottle's instance colour is. */
const BOTTLE_BOOST = 2.6;

/** The outline's width, in tiles. */
const OUTLINE = 0.015;

/** One model drawn many times: a single draw call per mesh of the model. */
export type Instances = {
  group: Group;
  /** Shows exactly `placements`, all of this model. */
  show(placements: readonly Placement[]): void;
};

/** A small gem: the stand-in for Items the kit has no model for. */
function gemModel(): Object3D {
  const gem = new Mesh(
    new OctahedronGeometry(0.1).scale(1, 1.4, 1),
    new MeshBasicMaterial({ color: 0xffffff }),
  );
  const group = new Group();
  group.add(gem);
  return group;
}

const matrix = new Matrix4();
const place = new Matrix4();
const turn = new Quaternion();
const facing = new Quaternion();
const spin = new Euler();
const where = new Vector3();
const size = new Vector3();
const colour = new Color();

/**
 * Instances `model` (a loaded KayKit scene, or `GEM`'s stand-in), keeping
 * one InstancedMesh per mesh of it, each with an outline that shares its
 * instances.
 */
export function instancesOf(file: string, scene: Object3D | null): Instances {
  const model = file === GEM || !scene ? gemModel() : scene.clone(true);
  // Loot glints: the gem is unlit, the models lifted a little out of the dark.
  if (file !== GEM) toonShade(model, LOOKS.warm);
  const glow = glowOf(file);
  // Tinted bottles are darkened by their brown glass, so the tint is pushed.
  const boost = file.includes("bottle") ? BOTTLE_BOOST : 1;
  const group = new Group();
  model.updateMatrixWorld(true);
  const parts: { mesh: InstancedMesh; local: Matrix4 }[] = [];
  model.traverse((node) => {
    const source = node as Mesh;
    if (!source.isMesh) return;
    const material = source.material as MeshToonMaterial;
    if (glow !== null) {
      material.emissive = new Color(glow);
      material.emissiveIntensity = 0.3;
    } else if (file !== GEM) {
      material.emissive.setScalar(LIFT);
    }
    const mesh = new InstancedMesh(source.geometry, material, CAPACITY);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.setColorAt(0, colour.set(0xffffff));
    mesh.count = 0;
    // The instances move about the whole World; there's no box to cull by.
    mesh.frustumCulled = false;
    group.add(mesh);
    parts.push({ mesh, local: source.matrixWorld.clone() });
  });
  return {
    group,
    show(placements) {
      const count = Math.min(CAPACITY, placements.length);
      placements.slice(0, count).forEach((p, i) => {
        spin.set(...p.lay);
        // Laid flat first, then turned about the vertical to face its way.
        turn.setFromEuler(spin);
        place.compose(
          where.set(p.x, p.height, p.y),
          facing.setFromAxisAngle(UP, p.yaw).multiply(turn),
          size.setScalar(p.base * p.scale),
        );
        for (const { mesh, local } of parts) {
          mesh.setMatrixAt(i, matrix.multiplyMatrices(place, local));
          mesh.setColorAt(
            i,
            colour.set(p.tint ?? 0xffffff).multiplyScalar(boost),
          );
        }
      });
      for (const { mesh } of parts) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      // The outlines share the instances, but count their own.
      for (const child of group.children)
        (child as InstancedMesh).count = count;
    },
  };
}

const UP = new Vector3(0, 1, 0);

/** Gives the instances of `file` outlines, once their `group` has the meshes. */
export function outlineInstances(instances: Instances, base: number) {
  for (const mesh of [...instances.group.children]) {
    outline(mesh, OUTLINE, base);
  }
}
