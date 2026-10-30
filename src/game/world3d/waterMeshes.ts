import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
} from "three";
import type { Area } from "../sim/area";

/**
 * How Water looks: the plane sits `depth` below the floor's top, so the
 * ground around a pond reads as a bank, in plain blue-green that swings
 * between `colour` and `glint` once every `shimmerSeconds`.
 */
export const WATER_LOOK = {
  depth: 0.08,
  colour: 0x2f8fb0,
  glint: 0x4fb3c4,
  shimmerSeconds: 3.5,
};

/** One pond: the tiles of a run of neighbouring Water, as `[x, y]` cells. */
export type Pond = { tiles: { x: number; y: number }[] };

/**
 * The Area's ponds: each group of Water tiles that touch along an edge is one
 * pond, found left to right and top to bottom.
 */
export function pondsOf(area: Area): Pond[] {
  const seen = new Set<number>();
  const ponds: Pond[] = [];
  const isWater = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < area.width &&
    y < area.height &&
    area.water[y * area.width + x];
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      if (!isWater(x, y) || seen.has(y * area.width + x)) continue;
      const tiles: Pond["tiles"] = [];
      const queue = [{ x, y }];
      seen.add(y * area.width + x);
      for (let next = queue.pop(); next; next = queue.pop()) {
        tiles.push(next);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const at = { x: next.x + dx, y: next.y + dy };
          const key = at.y * area.width + at.x;
          if (!isWater(at.x, at.y) || seen.has(key)) continue;
          seen.add(key);
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
  const material = new MeshBasicMaterial({
    color: WATER_LOOK.colour,
    side: DoubleSide,
  });
  for (const pond of pondsOf(area)) {
    const positions: number[] = [];
    const indices: number[] = [];
    pond.tiles.forEach(({ x, y }, i) => {
      positions.push(
        x,
        -WATER_LOOK.depth,
        y,
        x + 1,
        -WATER_LOOK.depth,
        y,
        x + 1,
        -WATER_LOOK.depth,
        y + 1,
        x,
        -WATER_LOOK.depth,
        y + 1,
      );
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
    plane.userData.pond = pond;
    group.add(plane);
  }
  const base = new Color(WATER_LOOK.colour);
  const glint = new Color(WATER_LOOK.glint);
  return {
    group,
    update(seconds) {
      const wave =
        0.5 +
        0.5 * Math.sin((seconds / WATER_LOOK.shimmerSeconds) * 2 * Math.PI);
      material.color.copy(base).lerp(glint, wave);
    },
  };
}
