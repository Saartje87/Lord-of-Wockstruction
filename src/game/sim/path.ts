import { type Area, isWalkable } from "./area";
import { tileOf, type Vec } from "./vec";

const EDGE_SLACK = 1e-6;

/**
 * Plans a walk from `from` to `to` as waypoints in tile units, not including
 * `from`. Tiles are joined in 8 directions without cutting a blocked corner,
 * then string-pulled: each waypoint is skipped while the line past it keeps
 * `radius` clear of walls.
 *
 * When `to` can't be reached, the walk ends at the reachable point nearest to
 * it, kept `radius` inside its tile.
 */
export function findPath(
  area: Area,
  from: Vec,
  to: Vec,
  radius: number,
): Vec[] {
  const { tiles, reached } = astar(area, tileOf(from), to);
  const end = reached ? to : clampInto(tiles[tiles.length - 1], to, radius);

  // The start tile is where we already are; aim at the end in the last one.
  const points = [...tiles.slice(1, -1).map(centre), end];
  const path: Vec[] = [];
  let at = from;
  let i = 0;
  while (i < points.length) {
    // Neighbouring tiles always join in a straight line, so `i` is safe.
    let j = i;
    while (j + 1 < points.length && isClear(area, at, points[j + 1], radius)) {
      j++;
    }
    path.push(points[j]);
    at = points[j];
    i = j + 1;
  }
  return path;
}

/**
 * Hand-rolled 8-direction A* over walkable tiles. Returns the tiles from
 * `start` to the tile of `to`, or, when that can't be reached, to the
 * reachable tile nearest `to`.
 */
function astar(
  area: Area,
  start: Vec,
  to: Vec,
): { tiles: Vec[]; reached: boolean } {
  const { width } = area;
  const goal = tileOf(to);
  const key = (x: number, y: number) => y * width + x;
  const open = (x: number, y: number) => isWalkable(area, { x, y });
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - goal.x);
    const dy = Math.abs(y - goal.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const tilesTo = (k: number) => {
    const tiles: Vec[] = [];
    for (let at: number | undefined = k; at !== undefined; at = came.get(at)) {
      tiles.unshift({ x: at % width, y: Math.floor(at / width) });
    }
    return tiles;
  };

  const g = new Map<number, number>();
  const came = new Map<number, number>();
  const closed = new Set<number>();
  const heap = new MinHeap();
  const startKey = key(start.x, start.y);
  g.set(startKey, 0);
  heap.push(startKey, h(start.x, start.y));

  let nearest = startKey;
  let nearestDistance = Number.POSITIVE_INFINITY;
  while (heap.size > 0) {
    const k = heap.pop();
    if (closed.has(k)) continue;
    closed.add(k);
    const x = k % width;
    const y = Math.floor(k / width);
    if (x === goal.x && y === goal.y)
      return { tiles: tilesTo(k), reached: true };

    const distance = squaredDistance(clampInto({ x, y }, to, 0), to);
    if (distance < nearestDistance) {
      nearest = k;
      nearestDistance = distance;
    }

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!open(nx, ny)) continue;
        // No corner cutting: a diagonal needs both sides open.
        if (dx && dy && (!open(x + dx, y) || !open(x, y + dy))) continue;
        const nk = key(nx, ny);
        const ng = (g.get(k) ?? 0) + (dx && dy ? Math.SQRT2 : 1);
        if (ng < (g.get(nk) ?? Number.POSITIVE_INFINITY)) {
          g.set(nk, ng);
          came.set(nk, k);
          heap.push(nk, ng + h(nx, ny));
        }
      }
    }
  }
  return { tiles: tilesTo(nearest), reached: false };
}

/**
 * Whether a body of `radius` can walk the straight line from `a` to `b`: the
 * line and its two edges `radius` either side touch only walkable tiles.
 */
export function isClear(area: Area, a: Vec, b: Vec, radius: number): boolean {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length === 0) return isWalkable(area, a);
  // A hair under `radius`, so a body exactly `radius` from a wall (where a
  // walk that stopped against it leaves the Hero) still counts as clear: an
  // edge landing exactly on a tile's far side would otherwise touch it.
  const reach = radius - EDGE_SLACK;
  const ox = (-(b.y - a.y) / length) * reach;
  const oy = ((b.x - a.x) / length) * reach;
  return [0, 1, -1].every((side) =>
    touchesOnlyWalkable(
      area,
      { x: a.x + ox * side, y: a.y + oy * side },
      { x: b.x + ox * side, y: b.y + oy * side },
    ),
  );
}

/** Whether nothing blocks the line of sight from `a` to `b`. */
export function canSee(area: Area, a: Vec, b: Vec): boolean {
  return touchesOnlyWalkable(area, a, b);
}

/**
 * Walks every tile the segment from `a` to `b` touches. Where it passes
 * exactly through a corner, both tiles beside the corner count as touched.
 */
function touchesOnlyWalkable(area: Area, a: Vec, b: Vec): boolean {
  const open = (x: number, y: number) => isWalkable(area, { x, y });
  let { x, y } = tileOf(a);
  const end = tileOf(b);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  // How far along the segment (0..1) the next x and y tile edges are.
  const edge = (from: number, tile: number, step: number, d: number) =>
    step > 0
      ? (tile + 1 - from) / d
      : step < 0
        ? (tile - from) / d
        : Number.POSITIVE_INFINITY;
  let nextX = edge(a.x, x, stepX, dx);
  let nextY = edge(a.y, y, stepY, dy);
  const deltaX = stepX ? Math.abs(1 / dx) : Number.POSITIVE_INFINITY;
  const deltaY = stepY ? Math.abs(1 / dy) : Number.POSITIVE_INFINITY;

  if (!open(x, y)) return false;
  while ((x !== end.x || y !== end.y) && Math.min(nextX, nextY) <= 1) {
    if (nextX < nextY) {
      x += stepX;
      nextX += deltaX;
    } else if (nextY < nextX) {
      y += stepY;
      nextY += deltaY;
    } else {
      if (!open(x + stepX, y) || !open(x, y + stepY)) return false;
      x += stepX;
      y += stepY;
      nextX += deltaX;
      nextY += deltaY;
    }
    if (!open(x, y)) return false;
  }
  return true;
}

const centre = (tile: Vec): Vec => ({ x: tile.x + 0.5, y: tile.y + 0.5 });

/** The point in `tile`, kept `inset` from its edges, nearest to `point`. */
function clampInto(tile: Vec, point: Vec, inset: number): Vec {
  const clamp = (v: number, lo: number) =>
    Math.min(Math.max(v, lo + inset), lo + 1 - inset);
  return { x: clamp(point.x, tile.x), y: clamp(point.y, tile.y) };
}

function squaredDistance(a: Vec, b: Vec): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

/** A binary min-heap of keys by priority; ties pop in no promised order. */
class MinHeap {
  private keys: number[] = [];
  private priorities: number[] = [];

  get size() {
    return this.keys.length;
  }

  push(key: number, priority: number) {
    this.keys.push(key);
    this.priorities.push(priority);
    let i = this.keys.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.priorities[parent] <= this.priorities[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.keys[0];
    const lastKey = this.keys.pop() as number;
    const lastPriority = this.priorities.pop() as number;
    if (this.keys.length > 0) {
      this.keys[0] = lastKey;
      this.priorities[0] = lastPriority;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (
          left < this.keys.length &&
          this.priorities[left] < this.priorities[smallest]
        ) {
          smallest = left;
        }
        if (
          right < this.keys.length &&
          this.priorities[right] < this.priorities[smallest]
        ) {
          smallest = right;
        }
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number) {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.priorities[a], this.priorities[b]] = [
      this.priorities[b],
      this.priorities[a],
    ];
  }
}
