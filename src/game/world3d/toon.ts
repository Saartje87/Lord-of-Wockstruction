import {
  BackSide,
  DataTexture,
  InstancedMesh,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  type Object3D,
  RedFormat,
  SkinnedMesh,
  type Texture,
} from "three";

/** Three light steps, so shading reads as flat bands of colour. */
const BANDS = new DataTexture(new Uint8Array([70, 150, 255]), 3, 1, RedFormat);
BANDS.minFilter = NearestFilter;
BANDS.magFilter = NearestFilter;
BANDS.needsUpdate = true;

/**
 * How a model's colours are pushed towards gothic: `saturation` keeps that
 * much of the texture's colour (1 is untouched), `tint` multiplies it.
 */
export type Look = { saturation: number; tint: number };

export const LOOKS = {
  /** Floors and Walls: cold, dark, almost grey stone. */
  stone: { saturation: 0.18, tint: 0x7e8cba },
  /** Town's dirt and paths: dusk light on earth, with its colour left. */
  dusk: { saturation: 0.6, tint: 0xbcc0e4 },
  /** Grass, green trees and bushes: green kept, only dimmed to the dusk. */
  green: { saturation: 0.9, tint: 0xf0f6ec },
  /** Props: a little of their own colour left, still cold. */
  prop: { saturation: 0.4, tint: 0x9aa4c8 },
  /** Characters keep their colours, which carry who they are. */
  character: { saturation: 0.85, tint: 0xffffff },
  /** Raised Skeletons: paler and tinged with the green of raised bone. */
  raised: { saturation: 0.6, tint: 0xa8f0b8 },
  /** Fire, magic, loot and danger keep their warmth. */
  warm: { saturation: 1, tint: 0xffffff },
} satisfies Record<string, Look>;

/** The look of a KayKit piece (`dungeon/wall`, `halloween/crypt`, ...). */
export function lookOf(piece: string): Look {
  const name = piece.slice(piece.indexOf("/") + 1);
  if (piece.startsWith("city/")) return LOOKS.green;
  if (/torch|candle|lantern|pumpkin/.test(name)) return LOOKS.warm;
  if (piece.startsWith("halloween/") && /^(floor|path)/.test(name)) {
    return LOOKS.dusk;
  }
  if (/^(floor|wall|pillar|column|path|fence|rubble)/.test(name)) {
    return LOOKS.stone;
  }
  return LOOKS.prop;
}

/**
 * Gives every mesh of `model` toon shading in `look`, a material of its own
 * (so a character can flash alone), keeping its texture and colour.
 */
export function toonShade(model: Object3D, look: Look = LOOKS.stone) {
  model.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const old = mesh.material as Material & { map?: Texture | null };
    const standard = old as MeshToonMaterial;
    const material = new MeshToonMaterial({
      map: old.map ?? null,
      color: standard.color,
      gradientMap: BANDS,
      transparent: old.transparent,
      alphaTest: old.alphaTest,
    });
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float grey = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(vec3(grey), diffuseColor.rgb, ${look.saturation.toFixed(3)});
        diffuseColor.rgb *= vec3(${tintOf(look.tint)});`,
      );
    };
    material.customProgramCacheKey = () =>
      `${look.saturation}-${look.tint.toString(16)}`;
    mesh.material = material;
  });
}

/** `tint` as a GLSL vec3's components, in linear colour. */
function tintOf(tint: number): string {
  const channel = (shift: number) => ((tint >> shift) & 255) / 255;
  const linear = (c: number) => c ** 2.2;
  return [16, 8, 0].map((s) => linear(channel(s)).toFixed(4)).join(", ");
}

/** The dark ink the outlines are drawn in. */
const INK = 0x050309;

/** The colour of the outline round a hovered or targeted character. */
const HIGHLIGHT = 0xffd35a;

/** How much wider the highlight outline is than the ink one. */
const HIGHLIGHT_WIDER = 1.7;

/** Outline materials, one per thickness and colour. */
const hulls = new Map<string, MeshBasicMaterial>();

function hullMaterial(thickness: number, colour = INK): MeshBasicMaterial {
  const key = `${thickness}-${colour}`;
  const known = hulls.get(key);
  if (known) return known;
  const material = new MeshBasicMaterial({ color: colour, side: BackSide });
  material.toneMapped = false;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      transformed += normalize(normal) * ${thickness.toFixed(5)};`,
    );
  };
  material.customProgramCacheKey = () => `hull-${thickness}`;
  hulls.set(key, material);
  return material;
}

/** The outline materials of a character: its ink, and its highlight. */
export type Inks = { ink: MeshBasicMaterial; highlight: MeshBasicMaterial };

/** The ink and highlight outlines `outline` gives meshes at `scale`. */
export function inksOf(thickness: number, scale: number): Inks {
  const width = thickness / scale;
  return {
    ink: hullMaterial(Number(width.toFixed(4))),
    highlight: hullMaterial(
      Number((width * HIGHLIGHT_WIDER).toFixed(4)),
      HIGHLIGHT,
    ),
  };
}

/** The outline meshes (those `outline` added) under `model`. */
export function outlinesOf(model: Object3D): Mesh[] {
  const found: Mesh[] = [];
  model.traverse((node) => {
    if ((node as Mesh).isMesh && node.userData.isOutline) {
      found.push(node as Mesh);
    }
  });
  return found;
}

/**
 * Adds an outline to every mesh of `model`: a copy that is a little bigger
 * and only shows its inside, in dark ink (an inverted hull). Unlike
 * three.js's OutlineEffect it works on instanced meshes, which it shares
 * the instances of, and on skinned ones, which it shares the skeleton of.
 *
 * `thickness` is the outline's width in tile units for a mesh drawn at
 * `scale` (the meshes' own units are `scale` times a tile).
 */
export function outline(model: Object3D, thickness: number, scale: number) {
  const hull = hullMaterial(Number((thickness / scale).toFixed(4)));
  const meshes: Mesh[] = [];
  model.traverse((node) => {
    const mesh = node as Mesh;
    if (mesh.isMesh && !mesh.userData.isOutline) meshes.push(mesh);
  });
  for (const mesh of meshes) {
    let copy: Mesh;
    if ((mesh as SkinnedMesh).isSkinnedMesh) {
      const skinned = mesh as SkinnedMesh;
      const outlined = new SkinnedMesh(skinned.geometry, hull);
      outlined.bind(skinned.skeleton, skinned.bindMatrix);
      copy = outlined;
    } else if ((mesh as InstancedMesh).isInstancedMesh) {
      const instanced = mesh as InstancedMesh;
      const outlined = new InstancedMesh(
        instanced.geometry,
        hull,
        instanced.count,
      );
      outlined.instanceMatrix = instanced.instanceMatrix;
      copy = outlined;
    } else {
      copy = new Mesh(mesh.geometry, hull);
    }
    copy.userData.isOutline = true;
    copy.frustumCulled = mesh.frustumCulled;
    copy.position.copy(mesh.position);
    copy.quaternion.copy(mesh.quaternion);
    copy.scale.copy(mesh.scale);
    mesh.parent?.add(copy);
  }
}

/** The toon materials of every mesh under `model`, except outlines'. */
export function materialsOf(model: Object3D): MeshToonMaterial[] {
  const materials: MeshToonMaterial[] = [];
  model.traverse((node) => {
    const mesh = node as Mesh;
    if (mesh.isMesh && !mesh.userData.isOutline) {
      materials.push(mesh.material as MeshToonMaterial);
    }
  });
  return materials;
}

/**
 * Washes an actor's own materials with `colour` at `amount` (0 leaves them
 * as they are): the hit flash is white, the Level-Up glow gold.
 */
export function glowMaterials(
  materials: readonly MeshToonMaterial[],
  colour: number,
  amount: number,
) {
  for (const material of materials) {
    material.emissive.set(colour).multiplyScalar(amount);
  }
}
