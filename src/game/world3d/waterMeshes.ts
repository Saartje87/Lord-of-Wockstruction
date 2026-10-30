import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
} from "three";
import { type Area, isWater } from "../sim/area";
import { cornersOf, type Vec } from "../sim/vec";

/**
 * How Water looks: the plane sits `depth` below the floor's top, so the
 * ground around a pond reads as a bank, and swings between a look's `colour`
 * and `glint` once every `shimmerSeconds`. Both are the same for plain Water
 * and hot springs; only the colours differ.
 */
export const WATER_LOOK = {
  depth: 0.08,
  shimmerSeconds: 3.5,
  /** Plain blue-green. */
  plain: { colour: 0x2f8fb0, glint: 0x4fb3c4 },
  /** A warm turquoise. */
  hotSprings: { colour: 0x35b8a4, glint: 0x6fd6bd },
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

/** The Area's ponds in the scene, and how they shimmer. */
export type WaterMeshes = {
  group: Group;
  /** Shimmers the Water for `seconds` into the game. */
  update(seconds: number): void;
};

/**
 * The Area's Water: one flat plane per pond, a square for each of its tiles,
 * all sharing one plain material. No KayKit model: the planes are made in
 * code.
 */
export function waterMeshesOf(area: Area): WaterMeshes {
  const group = new Group();
  const look = area.hotSprings ? WATER_LOOK.hotSprings : WATER_LOOK.plain;
  const material = new MeshBasicMaterial({
    color: look.colour,
    side: DoubleSide,
  });
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
  const base = new Color(look.colour);
  const glint = new Color(look.glint);
  const steam = area.hotSprings ? steamOf(pondsOf(area)) : null;
  if (steam) group.add(steam.points);
  return {
    group,
    update(seconds) {
      steam?.rise(seconds);
      const wave =
        0.5 +
        0.5 * Math.sin((seconds / WATER_LOOK.shimmerSeconds) * 2 * Math.PI);
      material.color.copy(base).lerp(glint, wave);
    },
  };
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
