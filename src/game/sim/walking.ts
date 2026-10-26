import type { Area } from "./area";
import { findPath, isClear } from "./path";
import type { Vec } from "./vec";

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

/** How a walker walks: its size and how often it re-plans around walls. */
export type Gait = { radius: number; replanSteps: number };

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
  if (isClear(area, walker.pos, to, gait.radius)) {
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
    walker.path = findPath(area, walker.pos, to, gait.radius);
    walker.replan = gait.replanSteps;
  }
  walkAlong(walker, walker.path, budget);
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
