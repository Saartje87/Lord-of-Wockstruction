import type { DamageShares } from "../tuning/damage";
import { heroTuning } from "../tuning/hero";
import { minionTuning } from "../tuning/minions";
import { monsterTuning } from "../tuning/monsters";
import type { ProjectileKind } from "../tuning/projectiles";
import { altarRadiusOf, type BoneAltar, targetsOf } from "./boneAltars";
import { BONE_WALL_REACH, type BoneWallPiece } from "./boneWalls";
import { targetsInCircle } from "./melee";
import type { MinionOfLevel } from "./minions";
import { canSee } from "./path";
import type { Vec } from "./vec";
import type { Monster, MonsterId, MonsterTarget, World } from "./world";

/**
 * The numbers an attack rolls with, fixed when it is made: a Projectile
 * keeps them however its Monster fares after loosing it.
 */
export type AttackNumbers = {
  attackRating: number;
  /** Damage per hit, rolled from `[min, max]` inclusive. */
  damage: [number, number];
  /** How the damage splits over Damage Types; missing, all Physical. */
  damageTypes?: DamageShares;
};

/**
 * Something loosed by an attack or a Skill, flying in a straight line through
 * the Area: a Skeleton Archer's Arrow, or the Hero's Bone Spear.
 */
export type Projectile =
  | MonsterProjectile
  | LobbedProjectile
  | HeroProjectile
  | MinionProjectile;

/** What every Projectile has, whoever loosed it or however it flies. */
type Airborne = {
  kind: ProjectileKind;
  /** Where it is, on the ground below it when it is lobbed. */
  pos: Vec;
  prevPos: Vec;
  /** Which way it flies: a unit vector in tile space. */
  direction: Vec;
};

/** What a Projectile flying in a straight line has. */
type Flight = Airborne & {
  /** How far it flies each step (tiles). */
  speed: number;
  /** How far it has left to fly before it vanishes (tiles). */
  rangeLeft: number;
};

/**
 * A Monster's Projectile: it hits the first of the Hero and their Minions it
 * touches, and flies through Monsters.
 */
export type MonsterProjectile = Flight &
  AttackNumbers & {
    /** The Monster that loosed it. */
    from: MonsterId;
  };

/**
 * A Monster's lobbed Projectile, Muck: it flies in an arc to the point its
 * target stood at when it was loosed, over everything, and hits nothing on
 * the way. On landing it hits every living Hero and Minion within its circle,
 * once each, and is gone. It carries the numbers it was loosed with.
 */
export type LobbedProjectile = Airborne &
  AttackNumbers & {
    /** Marks it as lobbed: it flies to a `landing`, not until out of range. */
    lob: true;
    /** The Monster that loosed it. */
    from: MonsterId;
    /** Where it was loosed from. */
    origin: Vec;
    /** The point it lands on, marked on the ground from the moment it is loosed. */
    landing: Vec;
    /** The radius of the circle it hits within there (tiles). */
    radius: number;
    /** How far along its arc it is, from 0 (loosed) to 1 (landing). */
    progress: number;
    /** How much of its arc it flies each step. */
    rate: number;
    /**
     * Set when it lands as a burning circle (Gravefire), burning for `steps`
     * steps and hitting every `every` steps, rather than as one blow.
     */
    burn?: { steps: number; every: number };
  };

/**
 * A burning circle, where a Gravefire landed: for the steps it has left it
 * hits every living Hero and Minion within `radius` of `pos` each `every`
 * steps, with the numbers the Gravefire was cast with. It outlives its
 * Monster and hits no Monster.
 */
export type Burn = AttackNumbers & {
  pos: Vec;
  radius: number;
  /** Steps left until it burns out. */
  left: number;
  /** Steps between hits. */
  every: number;
  /** Steps until its next hit. */
  next: number;
  /** Its burn length in steps, for how far through it is. */
  steps: number;
};

/**
 * The Hero's Projectile: it hits every Monster and Bone Altar it touches,
 * each once, and flies through the Hero's Minions.
 */
export type HeroProjectile = Flight & {
  from: "hero";
  /** Damage per hit, rolled from `[min, max]` inclusive. It always hits. */
  damage: [number, number];
  /** The Monsters and Bone Altars it has hit. */
  hit: MonsterId[];
};

/**
 * A Minion's Projectile, a Monster's reversed: it hits the first Monster or
 * Bone Altar it touches with no wall between, and flies through the Hero and
 * their Minions and Bone Wall pieces. It rolls its hit as the Minion's
 * swings do, with the Minion's numbers as they were when it was loosed.
 */
export type MinionProjectile = Flight & {
  from: "minion";
  /** The type, Skill Level and Synergy of the Minion that loosed it. */
  minion: MinionOfLevel;
};

/** Whether `projectile` is lobbed, flying an arc to a point. */
export function isLobbed(
  projectile: Projectile,
): projectile is LobbedProjectile {
  return "lob" in projectile;
}

/**
 * Burns every burning circle one step: it hits every Hero (not in Death) and
 * Minion in its circle by calling `land` each time its tick comes, and is
 * removed once burnt out, calling `burnt` on it. Returns nothing else.
 */
export function stepBurns(
  world: World,
  land: (burn: AttackNumbers, target: MonsterTarget) => void,
  burnt: (burn: Burn) => void,
) {
  world.burns = world.burns.filter((burn) => {
    burn.left -= 1;
    burn.next -= 1;
    if (burn.next <= 0) {
      burn.next = burn.every;
      for (const target of targetsInCircle(world, burn.pos, burn.radius)) {
        land(burn, target);
      }
    }
    if (burn.left > 0) return true;
    burnt(burn);
    return false;
  });
}

/**
 * Moves every Projectile one step along its line, in order. A Minion's
 * Projectile calls `shoot` on the first Monster or Bone Altar it touches with
 * no wall between. A Monster's calls `land` on the Hero, unless they are in
 * Death, or on one of their Minions, the first of them it touches, with no
 * wall between. Each lands before the next moves, so one reaching the Hero on
 * the step another kills them flies on over them. The Hero's calls `strike`
 * on each Monster it touches with no wall between, nearest first, and that it
 * hasn't hit before. A Projectile that lands, meets a blocking tile or has
 * flown its range is removed. A Monster's is also stopped by the first Bone
 * Wall piece it touches, before anything past it, and calls `hitWall` on that
 * piece; the Hero's and Minions' fly through. A lobbed one flies its arc past
 * everything, and on arriving calls `land` on the Hero, unless they are in
 * Death, and on each Minion, within its circle.
 */
export function stepProjectiles(
  world: World,
  land: (projectile: AttackNumbers, target: MonsterTarget) => void,
  strike: (projectile: HeroProjectile, target: Monster | BoneAltar) => void,
  hitWall: (projectile: MonsterProjectile, piece: BoneWallPiece) => void,
  shoot: (projectile: MinionProjectile, target: Monster | BoneAltar) => void,
) {
  const area = world.areas[world.areaName];
  world.projectiles = world.projectiles.filter((projectile) => {
    if (isLobbed(projectile)) return stepLobbed(world, projectile, land);
    const from = projectile.pos;
    const move = Math.min(projectile.speed, projectile.rangeLeft);
    const to = {
      x: from.x + projectile.direction.x * move,
      y: from.y + projectile.direction.y * move,
    };
    projectile.prevPos = { ...from };
    projectile.pos = to;
    projectile.rangeLeft -= move;
    if (projectile.from === "hero") {
      for (const target of targetsTouched(world, projectile, from, to)) {
        projectile.hit.push(target.id);
        strike(projectile, target);
      }
    } else if (projectile.from === "minion") {
      const [first] = targetsTouched(world, { hit: [] }, from, to);
      if (first) {
        shoot(projectile, first);
        return false;
      }
    } else {
      const stopper = firstPiece(world, from, to);
      const touched = firstTouched(world, from, stopper?.at ?? to);
      // A wall before what it touches stops it short.
      if (touched && canSee(area, from, touched.at)) {
        land(projectile, touched.target);
        return false;
      }
      if (stopper) {
        hitWall(projectile, stopper.piece);
        return false;
      }
    }
    if (!canSee(area, from, to)) return false;
    return projectile.rangeLeft > 0;
  });
}

/**
 * Moves `lobbed` along its arc, and on arrival lands it on the Hero and each
 * Minion within its circle. Returns whether it is still in the air.
 */
function stepLobbed(
  world: World,
  lobbed: LobbedProjectile,
  land: (projectile: AttackNumbers, target: MonsterTarget) => void,
): boolean {
  lobbed.progress = Math.min(1, lobbed.progress + lobbed.rate);
  lobbed.pos = {
    x: lobbed.origin.x + (lobbed.landing.x - lobbed.origin.x) * lobbed.progress,
    y: lobbed.origin.y + (lobbed.landing.y - lobbed.origin.y) * lobbed.progress,
  };
  if (lobbed.progress < 1) return true;
  if (lobbed.burn) {
    world.burns.push({
      attackRating: lobbed.attackRating,
      damage: lobbed.damage,
      damageTypes: lobbed.damageTypes,
      pos: { ...lobbed.landing },
      radius: lobbed.radius,
      left: lobbed.burn.steps,
      every: lobbed.burn.every,
      next: lobbed.burn.every,
      steps: lobbed.burn.steps,
    });
    return false;
  }
  for (const target of targetsInCircle(world, lobbed.landing, lobbed.radius)) {
    land(lobbed, target);
  }
  return false;
}

/**
 * The Monsters and Bone Altars a Hero's or Minion's `projectile`, flying from
 * `from` to `to`, touches with no wall between and isn't already in its `hit`
 * list, nearest `from` first. A Bone Altar blocks its own tile, so it is seen
 * up to its edge.
 */
function targetsTouched(
  world: World,
  projectile: Pick<HeroProjectile, "hit">,
  from: Vec,
  to: Vec,
): (Monster | BoneAltar)[] {
  const area = world.areas[world.areaName];
  const touched: { target: Monster | BoneAltar; along: number }[] = [];
  for (const target of targetsOf(world)) {
    if (projectile.hit.includes(target.id)) continue;
    const altar = altarRadiusOf(target) > 0;
    const radius = altar
      ? altarRadiusOf(target) + ALTAR_GRAZE
      : monsterTuning[(target as Monster).type].radius;
    const at = touching(target.pos, radius, from, to);
    if (!at) continue;
    const seen = altar
      ? backedOff(from, at.nearest, altarRadiusOf(target))
      : at.nearest;
    if (canSee(area, from, seen)) touched.push({ target, along: at.along });
  }
  return touched
    .sort((one, other) => one.along - other.along)
    .map(({ target }) => target);
}

/** How much further than its radius a Projectile touches a Bone Altar (tiles). */
const ALTAR_GRAZE = 0.25;

/** The point `back` before `to` on the line from `from`, or `from` if nearer. */
function backedOff(from: Vec, to: Vec, back: number): Vec {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length <= back) return { ...from };
  const along = (length - back) / length;
  return {
    x: from.x + (to.x - from.x) * along,
    y: from.y + (to.y - from.y) * along,
  };
}

/** The first Bone Wall piece a flight from `a` to `b` touches, and where. */
function firstPiece(
  world: World,
  a: Vec,
  b: Vec,
): { piece: BoneWallPiece; at: Vec } | null {
  let first: { piece: BoneWallPiece; at: Vec; along: number } | null = null;
  for (const piece of world.boneWalls) {
    const at = touching(piece.pos, BONE_WALL_REACH, a, b);
    if (at && (!first || at.along < first.along)) {
      first = { piece, at: at.nearest, along: at.along };
    }
  }
  return first;
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
    const at = touching(pos, radius, a, b);
    if (!at) continue;
    if (!first || at.along < first.along) {
      first = { target, at: at.nearest, along: at.along };
    }
  }
  return first;
}

/**
 * Where along the segment from `a` to `b`, from 0 to 1, and at which point it
 * comes nearest a body of `radius` at `pos`, if it touches it at all.
 */
function touching(
  pos: Vec,
  radius: number,
  a: Vec,
  b: Vec,
): { along: number; nearest: Vec } | null {
  const along = alongSegment(pos, a, b);
  const nearest = {
    x: a.x + along * (b.x - a.x),
    y: a.y + along * (b.y - a.y),
  };
  if (Math.hypot(pos.x - nearest.x, pos.y - nearest.y) > radius) return null;
  return { along, nearest };
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
