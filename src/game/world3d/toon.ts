import {
  DataTexture,
  type Material,
  type Mesh,
  MeshToonMaterial,
  NearestFilter,
  type Object3D,
  RedFormat,
  type Texture,
} from "three";

/** Three light steps, so shading reads as flat bands of colour. */
const BANDS = new DataTexture(new Uint8Array([70, 150, 255]), 3, 1, RedFormat);
BANDS.minFilter = NearestFilter;
BANDS.magFilter = NearestFilter;
BANDS.needsUpdate = true;

/**
 * Gives every mesh of `model` toon shading, a material of its own (so a
 * character can flash alone), keeping its texture and colour.
 */
export function toonShade(model: Object3D) {
  model.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const old = mesh.material as Material & { map?: Texture | null };
    const standard = old as MeshToonMaterial;
    mesh.material = new MeshToonMaterial({
      map: old.map ?? null,
      color: standard.color,
      gradientMap: BANDS,
      transparent: old.transparent,
      alphaTest: old.alphaTest,
    });
  });
}
