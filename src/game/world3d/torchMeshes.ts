// Torch drawing: the instanced holder and flame meshes for the torches the
// view says are lit. torches.ts decides where torches hang; lighting.ts lights.

import {
  ConeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  type Mesh,
  MeshBasicMaterial,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";
import { PIECE_SCALE } from "./floor";
import { FLAME_HEIGHT } from "./lighting";
import { flicker } from "./lights";
import { outline } from "./toon";
import type { WorldView } from "./view";

/** Torches are drawn a little larger than the model's tile scale. */
const TORCH_SCALE = PIECE_SCALE * 1.1;

/** Torches mounted on Walls, with flames that flicker. */
export type TorchMeshes = {
  group: Group;
  /** Shows the lit torches and their flames, burning at `seconds`. */
  show: (torches: WorldView["torches"], seconds: number) => void;
};

/**
 * One instanced mesh for the torch holders and one for the flames of the
 * Area's `torches`, hanging on the Walls' floor sides.
 */
export function torchMeshesOf(
  torches: WorldView["torches"],
  holder: Object3D,
): TorchMeshes {
  const up = new Vector3(0, 1, 0);
  const group = new Group();
  const pose = (i: number, scale: number, height: number) => {
    const torch = torches[i];
    return new Matrix4().compose(
      new Vector3(torch.pos.x, height, torch.pos.y),
      new Quaternion().setFromAxisAngle(up, torch.turn * (Math.PI / 2)),
      new Vector3(scale, scale, scale),
    );
  };

  const holders: { mesh: InstancedMesh; local: Matrix4 }[] = [];
  holder.updateMatrixWorld(true);
  holder.traverse((node) => {
    const source = node as Mesh;
    if (!source.isMesh) return;
    const mesh = new InstancedMesh(
      source.geometry,
      source.material,
      torches.length,
    );
    mesh.frustumCulled = false;
    holders.push({ mesh, local: source.matrixWorld.clone() });
    group.add(mesh);
  });
  outline(group, 0.014, TORCH_SCALE);

  const flameMaterial = new MeshBasicMaterial({ color: 0xffa040 });
  flameMaterial.toneMapped = false;
  const flames = new InstancedMesh(
    new ConeGeometry(0.05, 0.18, 6),
    flameMaterial,
    torches.length,
  );
  flames.frustumCulled = false;
  group.add(flames);

  const hidden = new Matrix4().makeScale(0, 0, 0);
  const flame = new Matrix4();
  return {
    group,
    show(now, seconds) {
      now.forEach((torch, i) => {
        for (const { mesh, local } of holders) {
          mesh.setMatrixAt(
            i,
            torch.lit
              ? pose(i, TORCH_SCALE, FLAME_HEIGHT - 0.2).multiply(local)
              : hidden,
          );
        }
        if (!torch.lit) {
          flames.setMatrixAt(i, hidden);
          return;
        }
        const strength = flicker(seconds, torch.wall);
        const out = torch.turn === 0 ? [0, 0.12] : [0.12, 0];
        flame.compose(
          new Vector3(torch.pos.x + out[0], FLAME_HEIGHT, torch.pos.y + out[1]),
          new Quaternion(),
          new Vector3(1, 0.7 + 0.5 * strength, 1),
        );
        flames.setMatrixAt(i, flame);
      });
      for (const { mesh } of holders) mesh.instanceMatrix.needsUpdate = true;
      flames.instanceMatrix.needsUpdate = true;
    },
  };
}
