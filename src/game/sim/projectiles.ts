import { heroTuning } from "../tuning/hero";
import { canSee } from "./path";
import type { Vec } from "./vec";
import type { MonsterId, World } from "./world";

/**
 * The numbers an attack rolls with, fixed when it is made: a Projectile
 * keeps them however its Monster fares after loosing it.
 */
export type AttackNumbers = {
  attackRating: number;
  /** Damage per hit, rolled from `[min, max]` inclusive. */
  damage: [number, number];
};

/**
 * Something loosed by an attack, flying in a straight line through the Area:
 * a Skeleton Archer's Arrow.
 */
export type Projectile = AttackNumbers & {
  pos: Vec;
  prevPos: Vec;
  /** Which way it flies: a unit vector in tile space. */
  direction: Vec;
  /** How far it flies each step (tiles). */
  speed: number;
  /** How far it has left to fly before it vanishes (tiles). */
  left: number;
  /** The Monster that loosed it. */
  from: MonsterId;
};

/**
 * Moves every Projectile one step along its line. One that touches the Hero
 * lands on them and is removed, as is one that meets a blocking tile or has
 * flown its range. It flies through Monsters. Returns those that landed.
 */
export function stepProjectiles(world: World): Projectile[] {
  const area = world.areas[world.areaName];
  const landed: Projectile[] = [];
  world.projectiles = world.projectiles.filter((projectile) => {
    const from = projectile.pos;
    const move = Math.min(projectile.speed, projectile.left);
    const to = {
      x: from.x + projectile.direction.x * move,
      y: from.y + projectile.direction.y * move,
    };
    projectile.prevPos = { ...from };
    projectile.pos = to;
    projectile.left -= move;
    if (gapToSegment(world.hero.pos, from, to) <= heroTuning.radius) {
      landed.push(projectile);
      return false;
    }
    if (!canSee(area, from, to)) return false;
    return projectile.left > 0;
  });
  return landed;
}

/** How near `point` comes to the segment from `a` to `b`. */
function gapToSegment(point: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length),
        );
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}
