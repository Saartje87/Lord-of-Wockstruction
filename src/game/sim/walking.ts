import type { Area } from "./area";
import {
  clearOfBodies,
  findPath,
  fitsAt,
  isClear,
  type Obstacle,
} from "./path";
import { distance, type Vec } from "./vec";

/** A creature the sim walks for itself: a Monster or a Minion. */
export type Walker = {
  pos: Vec;
  /** Which way it faces, in radians in tile space. */
  facing: number;
  /** The waypoints it is walking around walls. */
  path: Vec[];
  /** Steps until it re-plans its path. */
  replan: number;
};

/**
 * How a walker walks: its size against walls, never more than the Hero's,
 * and how often it re-plans around walls.
 */
export type Gait = {
  radius: number;
  replanSteps: number;
  /**
   * The walker's Body and the Bodies it can't walk through: it never ends a
   * step closer to one it overlaps, and plans its walk around them.
   */
  body?: { radius: number; obstacles: readonly Obstacle[] };
};

/**
 * Walks up to `budget` towards `to`: straight along a clear line, otherwise
 * along an A* path around walls, re-planned every so often as `to` moves.
 * `limit` caps a straight walk, so it can stop exactly short of `to`.
 */
export function goToward(
  area: Area,
  walker: Walker,
  gait: Gait,
  to: Vec,
  budget: number,
  limit = Number.POSITIVE_INFINITY,
) {
  const before = walker.pos;
  const pathBefore = [...walker.path];
  walkToward(area, walker, gait, to, budget, limit);
  if (gait.body && holdBack(area, walker, before, gait)) {
    walker.path = pathBefore;
    // Re-plan around whatever blocked the way.
    walker.replan = 0;
  }
}

/**
 * Undoes the part of a walk from `before` that ran into a Body of the
 * walker's `gait`, sliding along it on whichever axis is open, or standing
 * still. Returns whether the walk was held back.
 */
export function holdBack(
  area: Area,
  walker: Pick<Walker, "pos">,
  before: Vec,
  gait: Gait,
): boolean {
  const { radius, obstacles } = gait.body as NonNullable<Gait["body"]>;
  const hits = (at: Vec) =>
    obstacles.some((obstacle) => runsInto(obstacle, radius, before, at));
  if (!hits(walker.pos)) return false;
  const { x, y } = walker.pos;
  const slide = [
    { x, y: before.y },
    { x: before.x, y },
  ].find(
    (to) =>
      (to.x !== before.x || to.y !== before.y) &&
      !hits(to) &&
      fitsAt(area, to, gait.radius),
  );
  walker.pos = slide ?? before;
  return true;
}

/**
 * Where a step from `from` to `to` ends for a body of `radius` that can't
 * walk into the `obstacles`: `to` itself, else slid round the edge of any
 * Body it would run into (the nearest point to `to` just outside it), else
 * `from` where that doesn't fit at the walls either.
 */
export function slideAround(
  area: Area,
  from: Vec,
  to: Vec,
  radius: number,
  obstacles: readonly Obstacle[],
): Vec {
  const hits = (at: Vec) =>
    obstacles.filter((obstacle) => runsInto(obstacle, radius, from, at));
  let at = to;
  for (let pass = 0; pass < 3 && hits(at).length > 0; pass++) {
    for (const obstacle of hits(at)) {
      const dx = at.x - obstacle.pos.x;
      const dy = at.y - obstacle.pos.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) return from;
      const apart = obstacle.radius + radius;
      at = {
        x: obstacle.pos.x + (dx / length) * apart,
        y: obstacle.pos.y + (dy / length) * apart,
      };
    }
  }
  return hits(at).length === 0 && fitsAt(area, at, radius) ? at : from;
}

/**
 * Whether a body of `radius` stepping from `from` to `at` runs into
 * `obstacle`: it overlaps it there, and is closer than it was.
 */
function runsInto(
  obstacle: Obstacle,
  radius: number,
  from: Vec,
  at: Vec,
): boolean {
  const gap = distance(obstacle.pos, at);
  return (
    gap < obstacle.radius + radius - 1e-6 && gap < distance(obstacle.pos, from)
  );
}

/**
 * One walk of `walker` towards `to`, up to `budget` and, on a straight line,
 * `limit`: straight on where the line is clear of walls and of the Bodies of
 * its `gait`, else along its path, planned afresh when its timer runs out.
 */
function walkToward(
  area: Area,
  walker: Walker,
  gait: Gait,
  to: Vec,
  budget: number,
  limit: number,
) {
  const body = gait.body;
  if (
    isClear(area, walker.pos, to, gait.radius) &&
    (!body || clearOfBodies(walker.pos, to, body.radius, body.obstacles))
  ) {
    walker.path = [];
    walker.replan = 0;
    walkAlong(walker, [to], Math.min(budget, limit));
    return;
  }
  // Only on the timer, even with the path walked: where `to` can't be
  // reached, the path ends short of it, and re-planning there every step
  // would find the same path.
  walker.replan -= 1;
  if (walker.replan <= 0) {
    walker.path = findPath(
      area,
      walker.pos,
      to,
      gait.radius,
      body?.obstacles,
      body?.radius,
    );
    walker.replan = gait.replanSteps;
  }
  walkAlong(walker, walker.path, budget);
}

/**
 * Where a body of `radius` at `from` gets to walking `budget` in `direction`
 * (any length but 0): straight on if it fits there, else sliding along the
 * wall in the way, on whichever axis the direction leans to more first;
 * null where it can't move at all.
 */
export function stepInDirection(
  area: Area,
  from: Vec,
  direction: Vec,
  budget: number,
  radius: number,
): Vec | null {
  const length = Math.hypot(direction.x, direction.y);
  const dx = (direction.x / length) * budget;
  const dy = (direction.y / length) * budget;
  const across = { x: from.x + dx, y: from.y };
  const down = { x: from.x, y: from.y + dy };
  const slides = Math.abs(dx) >= Math.abs(dy) ? [across, down] : [down, across];
  const tries = [{ x: from.x + dx, y: from.y + dy }, ...slides];
  return (
    tries.find(
      (to) => (to.x !== from.x || to.y !== from.y) && fitsAt(area, to, radius),
    ) ?? null
  );
}

/**
 * Moves the walker up to `budget` through `points` in order, dropping each
 * one it reaches, and faces the way it walks.
 */
export function walkAlong(
  walker: Pick<Walker, "pos" | "facing">,
  points: Vec[],
  budget: number,
) {
  while (budget > 0 && points.length > 0) {
    const next = points[0];
    const dx = next.x - walker.pos.x;
    const dy = next.y - walker.pos.y;
    const gap = Math.hypot(dx, dy);
    if (gap > 0) walker.facing = Math.atan2(dy, dx);
    if (gap <= budget) {
      walker.pos = { ...next };
      points.shift();
      budget -= gap;
    } else {
      walker.pos = {
        x: walker.pos.x + (dx / gap) * budget,
        y: walker.pos.y + (dy / gap) * budget,
      };
      budget = 0;
    }
  }
}
