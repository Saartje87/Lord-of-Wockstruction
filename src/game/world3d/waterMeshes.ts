import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  Points,
  PointsMaterial,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from "three";
import { type Area, isWater } from "../sim/area";
import { cornersOf, type Vec } from "../sim/vec";

/**
 * How Water looks: the plane sits `depth` below the floor's top, so the
 * ground around a pond reads as a bank. Soft lighter bands in the look's
 * `glint` drift across it in World space: `bandSize` tiles from one band to
 * the next, travelling `bandSpeed` tiles a second, at `bandStrength` (0 to 1)
 * of the way from `colour` to `glint`. Plain Water and hot springs differ only
 * in colour.
 */
export const WATER_LOOK = {
  depth: 0.08,
  bandSize: 2.4,
  bandSpeed: 0.12,
  bandStrength: 0.9,
  /** A deep, dark blue-green. */
  plain: { colour: 0x1a6b82, glint: 0x4fb5c0 },
  /** A warm turquoise. */
  hotSprings: { colour: 0x2fc2a6, glint: 0x9ff0d8 },
};

/**
 * The steam over hot springs: a few faint wisps rising `steamHeight` above the
 * Water, each taking `steamSeconds` to rise and fade.
 */
export const HOT_SPRINGS_LOOK = {
  steamColour: 0xe8f4f0,
  steamOpacity: 0.3,
  steamSize: 14,
  steamHeight: 1.1,
  steamSeconds: 4,
  /** At most this many wisps per Area, about one for every tile. */
  steamMax: 32,
};

/**
 * One pond: a group of Water tiles that touch along an edge, as `{x, y}`
 * tiles. "Pond" names the group only, never a single tile.
 */
export type Pond = { tiles: { x: number; y: number }[] };

const NEIGHBOURS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/**
 * The Area's ponds: each group of Water tiles that touch along an edge is one
 * pond, found left to right and top to bottom.
 */
export function pondsOf(area: Area): Pond[] {
  const seen = new Set<number>();
  const keyOf = ({ x, y }: Vec) => y * area.width + x;
  const ponds: Pond[] = [];
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      const start = { x, y };
      if (!isWater(area, start) || seen.has(keyOf(start))) continue;
      const tiles: Pond["tiles"] = [];
      const queue = [start];
      seen.add(keyOf(start));
      for (let next = queue.pop(); next; next = queue.pop()) {
        tiles.push(next);
        for (const step of NEIGHBOURS) {
          const at = { x: next.x + step.x, y: next.y + step.y };
          if (!isWater(area, at) || seen.has(keyOf(at))) continue;
          seen.add(keyOf(at));
          queue.push(at);
        }
      }
      ponds.push({ tiles });
    }
  }
  return ponds;
}

/** The Area's ponds in the scene, and how their light drifts. */
export type WaterMeshes = {
  group: Group;
  /** Drifts the Water's light and steam for `seconds` into the game. */
  update(seconds: number): void;
};

/**
 * The Area's Water: one flat plane per pond, a square for each of its tiles,
 * all sharing one unlit, tone-mapping-free shader material. No KayKit model:
 * the planes are made in code.
 */
export function waterMeshesOf(area: Area): WaterMeshes {
  const group = new Group();
  const look = area.hotSprings ? WATER_LOOK.hotSprings : WATER_LOOK.plain;
  const material = driftingLight(look);
  for (const pond of pondsOf(area)) {
    const positions: number[] = [];
    const indices: number[] = [];
    pond.tiles.forEach(({ x, y }, i) => {
      for (const corner of cornersOf({ x, y })) {
        positions.push(corner.x, -WATER_LOOK.depth, corner.y);
      }
      const first = i * 4;
      indices.push(first, first + 2, first + 1, first, first + 3, first + 2);
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(positions), 3),
    );
    geometry.setIndex(indices);
    const plane = new Mesh(geometry, material);
    group.add(plane);
  }
  const steam = area.hotSprings ? steamOf(pondsOf(area)) : null;
  if (steam) group.add(steam.points);
  return {
    group,
    update(seconds) {
      steam?.rise(seconds);
      material.uniforms.uTime.value = seconds;
    },
  };
}

const VERTEX = `
varying vec2 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

// No tonemapping_fragment: Water keeps its colours. Two sine waves crossing
// at an angle make soft bands, drifting along World x and z.
const FRAGMENT = `
uniform vec3 uColour;
uniform vec3 uGlint;
uniform float uTime;
uniform float uBandSize;
uniform float uBandSpeed;
uniform float uBandStrength;
varying vec2 vWorld;
#include <fog_pars_fragment>
void main() {
  float t = uTime * uBandSpeed;
  float a = sin((vWorld.x * 0.8 + vWorld.y * 0.6 - t) * 6.2831853 / uBandSize);
  float b = sin((vWorld.x * -0.4 + vWorld.y * 0.9 - t * 0.7) * 6.2831853 / (uBandSize * 1.7));
  float band = smoothstep(0.35, 0.95, 0.5 + 0.25 * a + 0.25 * b);
  gl_FragColor = vec4(mix(uColour, uGlint, band * uBandStrength), 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/** The Water's material, shared by all its ponds. */
function driftingLight(look: { colour: number; glint: number }) {
  return new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uColour: { value: new Color(look.colour) },
        uGlint: { value: new Color(look.glint) },
        uTime: { value: 0 },
        uBandSize: { value: WATER_LOOK.bandSize },
        uBandSpeed: { value: WATER_LOOK.bandSpeed },
        uBandStrength: { value: WATER_LOOK.bandStrength },
      },
    ]),
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: DoubleSide,
    fog: true,
    toneMapped: false,
  });
}

/**
 * Wisps of steam over the ponds: each wisp stays over one tile, rising and
 * fading in a loop. Where it starts is worked out from its number alone, so
 * the same Area always steams the same way.
 */
function steamOf(ponds: Pond[]) {
  const tiles = ponds.flatMap((pond) => pond.tiles);
  const count = Math.min(tiles.length, HOT_SPRINGS_LOOK.steamMax);
  if (count === 0) return null;
  const geometry = new BufferGeometry();
  const positions = new BufferAttribute(new Float32Array(count * 3), 3);
  geometry.setAttribute("position", positions);
  const points = new Points(
    geometry,
    new PointsMaterial({
      color: HOT_SPRINGS_LOOK.steamColour,
      size: HOT_SPRINGS_LOOK.steamSize,
      sizeAttenuation: false,
      transparent: true,
      opacity: HOT_SPRINGS_LOOK.steamOpacity,
      depthWrite: false,
    }),
  );
  points.frustumCulled = false;
  // Spread over the tiles by a stride, so wisps do not bunch in one pond.
  const anchors = Array.from({ length: count }, (_, i) => ({
    ...tiles[(i * 7) % tiles.length],
    phase: (i * 0.618) % 1,
    sway: i * 2.3,
  }));
  return {
    points,
    rise(seconds: number) {
      anchors.forEach((wisp, i) => {
        const age = (seconds / HOT_SPRINGS_LOOK.steamSeconds + wisp.phase) % 1;
        positions.setXYZ(
          i,
          wisp.x + 0.5 + Math.sin(age * 5 + wisp.sway) * 0.15,
          -WATER_LOOK.depth + age * HOT_SPRINGS_LOOK.steamHeight,
          wisp.y + 0.5 + Math.cos(age * 4 + wisp.sway) * 0.15,
        );
      });
      positions.needsUpdate = true;
    },
  };
}
