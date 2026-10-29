import { type Material, type Object3D, SkinnedMesh } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Merges the skinned meshes of `model` that share a parent, a skeleton, a
 * material and a transform into one, so a character takes a draw call for
 * its body rather than one for each limb. Meshes that differ stay as they
 * are. Do it once per loaded model, before cloning it for its actors.
 */
export function mergeSkinned(model: Object3D) {
  const groups = new Map<string, SkinnedMesh[]>();
  model.traverse((node) => {
    const mesh = node as SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.parent) return;
    const key = [
      mesh.parent.uuid,
      mesh.skeleton.uuid,
      (mesh.material as Material).uuid,
      mesh.matrix.elements.join(),
      Object.keys(mesh.geometry.attributes).sort().join(),
      mesh.geometry.getIndex() ? "indexed" : "flat",
    ].join("|");
    groups.set(key, [...(groups.get(key) ?? []), mesh]);
  });
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const [first] = meshes;
    const geometry = mergeGeometries(meshes.map((mesh) => mesh.geometry));
    const merged = new SkinnedMesh(geometry, first.material);
    merged.name = first.name;
    merged.position.copy(first.position);
    merged.quaternion.copy(first.quaternion);
    merged.scale.copy(first.scale);
    merged.bind(first.skeleton, first.bindMatrix);
    first.parent?.add(merged);
    for (const mesh of meshes) mesh.removeFromParent();
  }
}
