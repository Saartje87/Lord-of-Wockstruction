import {
  Bone,
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  type Mesh,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
} from "three";
import { describe, expect, it } from "vitest";
import { mergeSkinned } from "./mergeSkinned";

/** A skinned box bound to `skeleton`, all its vertices on the first bone. */
function skinnedBox(skeleton: Skeleton, material: MeshStandardMaterial) {
  const geometry = new BoxGeometry(1, 1, 1);
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute(
    "skinIndex",
    new Uint16BufferAttribute(new Array(count * 4).fill(0), 4),
  );
  geometry.setAttribute(
    "skinWeight",
    new Float32BufferAttribute(
      Array.from({ length: count * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)),
      4,
    ),
  );
  const mesh = new SkinnedMesh(geometry, material);
  mesh.bind(skeleton);
  return mesh;
}

const character = () => {
  const root = new Group();
  const bone = new Bone();
  root.add(bone);
  const skeleton = new Skeleton([bone]);
  return { root, skeleton };
};

const meshesOf = (root: Group) => {
  const meshes: Mesh[] = [];
  root.traverse((node) => {
    if ((node as Mesh).isMesh) meshes.push(node as Mesh);
  });
  return meshes;
};

describe("merging a character's skinned meshes", () => {
  it("makes one mesh of those sharing a skeleton and a material", () => {
    const { root, skeleton } = character();
    const material = new MeshStandardMaterial();
    root.add(skinnedBox(skeleton, material), skinnedBox(skeleton, material));
    const triangles = meshesOf(root).reduce(
      (sum, mesh) => sum + (mesh.geometry.getIndex()?.count ?? 0) / 3,
      0,
    );

    mergeSkinned(root);

    const meshes = meshesOf(root);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].geometry.getIndex()?.count).toBe(triangles * 3);
    expect((meshes[0] as SkinnedMesh).skeleton).toBe(skeleton);
  });

  it("leaves meshes of another material alone", () => {
    const { root, skeleton } = character();
    root.add(
      skinnedBox(skeleton, new MeshStandardMaterial()),
      skinnedBox(skeleton, new MeshStandardMaterial()),
    );

    mergeSkinned(root);

    expect(meshesOf(root)).toHaveLength(2);
  });
});
