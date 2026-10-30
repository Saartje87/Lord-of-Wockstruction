// @vitest-environment node
import {
  BoxGeometry,
  DataTexture,
  Group,
  type InstancedMesh,
  Mesh,
  MeshStandardMaterial,
} from "three";
import { describe, expect, it } from "vitest";
import { instancesOf } from "./lootMeshes";

/** A stand-in for a KayKit model: one mesh textured with brown glass. */
function texturedModel(): Group {
  const brown = new DataTexture(new Uint8Array([120, 70, 30, 255]), 1, 1);
  const group = new Group();
  group.add(
    new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map: brown })),
  );
  return group;
}

describe("how a Potion bottle takes its colour", () => {
  it("is drawn in its tint alone, since a brown texture would turn blue to grey", () => {
    const { group } = instancesOf("loot/bottle_C_brown", texturedModel());
    const mesh = group.children[0] as InstancedMesh;
    expect((mesh.material as MeshStandardMaterial).map).toBeNull();
  });

  it("keeps the texture of other loot", () => {
    const { group } = instancesOf("loot/axe_1handed", texturedModel());
    const mesh = group.children[0] as InstancedMesh;
    expect((mesh.material as MeshStandardMaterial).map).not.toBeNull();
  });
});
