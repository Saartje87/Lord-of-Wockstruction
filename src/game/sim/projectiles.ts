import { heroTuning } from "../tuning/hero";
import { minionTuning } from "../tuning/minions";
import { canSee } from "./path";
import type { Vec } from "./vec";
import type { MonsterId, MonsterTarget, World } from "./world";

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

/** A Projectile landing on the Hero or their Minion this step. */
export type Landing = { projectile: Projectile; target: MonsterTarget };

/**
 * Moves every Projectile one step along its line. One that touches the Hero,
 * unless they are in Death, or their Minion lands on the first of them it
 * touches and is removed, as is one that meets a blocking tile or has flown
 * its range. It flies through Monsters. Returns those that landed.
 */
export function stepProjectiles(world: World): Landing[] {
  const area = world.areas[world.areaName];
  const landings: Landing[] = [];
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
    const target = firstTouched(world, from, to);
    if (target) {
      landings.push({ projectile, target });
      return false;
    }
    if (!canSee(area, from, to)) return false;
    return projectile.left > 0;
  });
  return landings;
}

/**
 * Which of the living Hero and their Minion a Projectile flying from `a` to
 * `b` touches first, if either.
 */
function firstTouched(world: World, a: Vec, b: Vec): MonsterTarget | null {
  const bodies: { target: MonsterTarget; pos: Vec; radius: number }[] = [];
  if (!world.death) {
    bodies.push({
      target: "hero",
      pos: world.hero.pos,
      radius: heroTuning.radius,
    });
  }
  const { minion } = world;
  if (minion) {
    bodies.push({
      target: "minion",
      pos: minion.pos,
      radius: minionTuning[minion.type].radius,
    });
  }
  let first: { target: MonsterTarget; along: number } | null = null;
  for (const { target, pos, radius } of bodies) {
    const along = alongSegment(pos, a, b);
    const nearest = {
      x: a.x + along * (b.x - a.x),
      y: a.y + along * (b.y - a.y),
    };
    if (Math.hypot(pos.x - nearest.x, pos.y - nearest.y) > radius) continue;
    if (!first || along < first.along) first = { target, along };
  }
  return first?.target ?? null;
}

/**
 * How far along the segment from `a` to `b`, from 0 to 1, its point nearest
 * `point` lies.
 */
function alongSegment(point: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  if (length === 0) return 0;
  return Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length),
  );
}
