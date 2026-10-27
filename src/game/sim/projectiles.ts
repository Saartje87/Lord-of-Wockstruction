import { heroTuning } from "../tuning/hero";
import { minionTuning } from "../tuning/minions";
import type { ProjectileKind } from "../tuning/monsters";
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
  kind: ProjectileKind;
  pos: Vec;
  prevPos: Vec;
  /** Which way it flies: a unit vector in tile space. */
  direction: Vec;
  /** How far it flies each step (tiles). */
  speed: number;
  /** How far it has left to fly before it vanishes (tiles). */
  rangeLeft: number;
  /** The Monster that loosed it. */
  from: MonsterId;
};

/**
 * Moves every Projectile one step along its line, in order, calling `land`
 * on each that touches the Hero, unless they are in Death, or one of their
 * Minions, the first of them it touches, with no wall between. Each lands
 * before the next moves, so one reaching the Hero on the step another kills
 * them flies on over them. A Projectile that lands, meets a blocking tile or has flown
 * its range is removed. It flies through Monsters.
 */
export function stepProjectiles(
  world: World,
  land: (projectile: Projectile, target: MonsterTarget) => void,
) {
  const area = world.areas[world.areaName];
  world.projectiles = world.projectiles.filter((projectile) => {
    const from = projectile.pos;
    const move = Math.min(projectile.speed, projectile.rangeLeft);
    const to = {
      x: from.x + projectile.direction.x * move,
      y: from.y + projectile.direction.y * move,
    };
    projectile.prevPos = { ...from };
    projectile.pos = to;
    projectile.rangeLeft -= move;
    const touched = firstTouched(world, from, to);
    // A wall before what it touches stops it short.
    if (touched && canSee(area, from, touched.at)) {
      land(projectile, touched.target);
      return false;
    }
    if (!canSee(area, from, to)) return false;
    return projectile.rangeLeft > 0;
  });
}

/**
 * Which of the living Hero and their Minions a Projectile flying from `a` to
 * `b` touches first, if any, and where along its flight it does.
 */
function firstTouched(
  world: World,
  a: Vec,
  b: Vec,
): { target: MonsterTarget; at: Vec } | null {
  const targets: { target: MonsterTarget; pos: Vec; radius: number }[] = [];
  if (!world.death) {
    targets.push({
      target: "hero",
      pos: world.hero.pos,
      radius: heroTuning.radius,
    });
  }
  for (const minion of world.minions) {
    targets.push({
      target: minion.id,
      pos: minion.pos,
      radius: minionTuning[minion.type].radius,
    });
  }
  let first: { target: MonsterTarget; at: Vec; along: number } | null = null;
  for (const { target, pos, radius } of targets) {
    const along = alongSegment(pos, a, b);
    const nearest = {
      x: a.x + along * (b.x - a.x),
      y: a.y + along * (b.y - a.y),
    };
    if (Math.hypot(pos.x - nearest.x, pos.y - nearest.y) > radius) continue;
    if (!first || along < first.along) first = { target, at: nearest, along };
  }
  return first;
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
