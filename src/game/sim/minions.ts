import {
  type MinionGrowth,
  type MinionType,
  minionTuning,
} from "../tuning/minions";
import { monsterTuning } from "../tuning/monsters";
import type { Skill } from "../tuning/skills";
import { isWalkable } from "./area";
import { attackSpot, freeSpot, monsterBodies, wallRadius } from "./bodies";
import { altarRadiusOf, type BoneAltar, targetsOf } from "./boneAltars";
import { faceToward, lands } from "./melee";
import { isClear } from "./path";
import { msToSteps, perStep } from "./units";
import { distance, type Vec } from "./vec";
import { type Gait, goToward } from "./walking";
import type { Monster, MonsterId, World } from "./world";

export type { MinionType };

/** Unique within the World and never reused; apart from Monster ids. */
export type MinionId = number;

/**
 * What a Minion is doing. With nothing to fight it follows the Hero,
 * teleporting next to them when far behind or stuck. It goes after a Monster
 * near the Hero in `chase`, telegraphs an attack on it in `windup` and stands
 * rooted after it in `recover`.
 */
export type MinionState = "follow" | "chase" | "windup" | "recover";

/** A creature on the Hero's side, brought by a Skill. */
export type Minion = {
  id: MinionId;
  type: MinionType;
  /** The Skill that brought it. */
  skill: Skill;
  /** The Skill Level of the Skill that brought it. */
  skillLevel: number;
  pos: Vec;
  /** Where it was one step ago, for the renderer to interpolate from. */
  prevPos: Vec;
  /** Never regained. */
  life: number;
  /** Which way it faces, in radians in tile space. */
  facing: number;
  state: MinionState;
  /** The Monster it is going after, while not following. */
  target: MonsterId | null;
  /**
   * While winding up, steps into the wind-up; while recovering, steps left
   * rooted.
   */
  attackSteps: number;
  /** Steps left before it can wind up again. */
  cooldown: number;
  /** The waypoints it is walking around walls. */
  path: Vec[];
  /** Steps until it re-plans its path. */
  replan: number;
  /** Steps in a row it has hardly moved while trying to. */
  stuck: number;
};

/** Each Minion type's tuning converted to steps. */
const STEPPED = Object.fromEntries(
  Object.entries(minionTuning).map(([type, tuning]) => [
    type,
    {
      speed: perStep(tuning.speed),
      stuckSteps: msToSteps(tuning.stuckMs),
      stuckStride: perStep(tuning.speed) * tuning.stuckStride,
      gait: {
        radius: wallRadius(tuning.radius),
        replanSteps: msToSteps(tuning.replanMs),
      },
      windUpSteps: msToSteps(tuning.windUpMs),
      rootSteps: msToSteps(tuning.rootMs),
      recoverySteps: msToSteps(tuning.recoveryMs),
      arc: (tuning.arcDegrees * Math.PI) / 180,
    },
  ]),
) as Record<
  MinionType,
  {
    speed: number;
    stuckSteps: number;
    stuckStride: number;
    gait: Gait;
    windUpSteps: number;
    rootSteps: number;
    recoverySteps: number;
    arc: number;
  }
>;

/** A Minion type at a Skill Level: all its scaled numbers depend on. */
export type MinionOfLevel = Pick<Minion, "type" | "skillLevel">;

/**
 * A Skill Level 1 number grown by `rate` of itself for each Skill Level
 * above 1, rounded to a whole number.
 */
function grown(value: number, rate: number, skillLevel: number): number {
  return Math.round(value * (1 + rate * (skillLevel - 1)));
}

/** One of a Minion type's single numbers grown to its Skill Level. */
function scaled(
  { type, skillLevel }: MinionOfLevel,
  number: Exclude<keyof MinionGrowth, "damage">,
): number {
  const tuning = minionTuning[type];
  return grown(tuning[number], tuning.growth[number], skillLevel);
}

/** A Minion's full Life at its Skill Level, which it is summoned with. */
export function minionMaxLife(minion: MinionOfLevel): number {
  return scaled(minion, "life");
}

/** The least and most damage a Minion's hit deals at its Skill Level. */
export function minionDamageRange({
  type,
  skillLevel,
}: MinionOfLevel): [number, number] {
  const { damage, growth } = minionTuning[type];
  return [
    grown(damage[0], growth.damage, skillLevel),
    grown(damage[1], growth.damage, skillLevel),
  ];
}

/** A Minion's Attack Rating at its Skill Level, against Monsters' Defense. */
export function minionAttackRating(minion: MinionOfLevel): number {
  return scaled(minion, "attackRating");
}

/**
 * A Minion's Defense at its Skill Level, which Monsters' Attack Rating has
 * to beat.
 */
export function minionDefense(minion: MinionOfLevel): number {
  return scaled(minion, "defense");
}

/** How far through its wind-up a winding-up Minion is, from 0 to 1. */
export function minionWindUpProgress(minion: Minion): number {
  return minion.attackSteps / STEPPED[minion.type].windUpSteps;
}

/** How far through its rooted recovery a recovering Minion is, from 0 to 1. */
export function minionRecoveryProgress(minion: Minion): number {
  return 1 - minion.attackSteps / STEPPED[minion.type].rootSteps;
}

/**
 * A fresh Minion of `type`, brought by `skill`, at `pos`, facing `facing`,
 * following the Hero.
 */
export function newMinion(
  id: MinionId,
  type: MinionType,
  skill: Skill,
  skillLevel: number,
  pos: Vec,
  facing: number,
): Minion {
  return {
    id,
    type,
    skill,
    skillLevel,
    pos: { ...pos },
    prevPos: { ...pos },
    life: minionMaxLife({ type, skillLevel }),
    facing,
    state: "follow",
    target: null,
    attackSteps: 0,
    cooldown: 0,
    path: [],
    replan: 0,
    stuck: 0,
  };
}

/**
 * Puts the Minion next to the Hero, facing their way, as if it had always
 * been there: behind them if it can walk straight there from the Hero, else
 * the nearest way round to it that it can, else on the Hero; then at the
 * nearest free spot to that, so no Body is under it. Minions in `pending`
 * are not there yet (still to be placed), so don't count.
 */
export function placeBesideHero(
  world: World,
  minion: Minion,
  pending: readonly Minion[] = [],
) {
  const area = world.areas[world.areaName];
  const { pos, facing } = world.hero;
  const { besideDistance } = minionTuning[minion.type];
  const { radius } = STEPPED[minion.type].gait;
  const at =
    [0, 1, -1, 2, -2, 3, -3, 4]
      .map((turn) => facing + Math.PI + (turn * Math.PI) / 4)
      .map((angle) => ({
        x: pos.x + besideDistance * Math.cos(angle),
        y: pos.y + besideDistance * Math.sin(angle),
      }))
      .find(
        (point) => isWalkable(area, point) && isClear(area, pos, point, radius),
      ) ?? pos;
  const spot =
    freeSpot(world, at, minionTuning[minion.type].radius, [
      minion,
      ...pending,
    ]) ?? at;
  minion.pos = { ...spot };
  minion.prevPos = { ...spot };
  minion.facing = facing;
  stopChasing(minion);
  minion.attackSteps = 0;
}

/**
 * Moves each of the Hero's Minions one step, in turn: fighting the Monsters
 * near the Hero, or else following them. Calls `strike` on each attack that
 * lands on a Monster, for the caller to roll the hit before the next Minion
 * moves.
 */
export function stepMinions(
  world: World,
  strike: (minion: Minion, target: Monster | BoneAltar) => void,
) {
  for (const minion of [...world.minions]) {
    const struck = stepMinion(world, minion);
    if (struck) strike(minion, struck);
  }
}

/**
 * Moves a Minion one step. Returns the Monster or Bone Altar its attack lands
 * on this step, if any.
 */
function stepMinion(world: World, minion: Minion): Monster | BoneAltar | null {
  if (minion.cooldown > 0) minion.cooldown -= 1;
  if (minion.state === "windup") return windUp(world, minion);
  if (minion.state === "recover") {
    minion.attackSteps -= 1;
    if (minion.attackSteps > 0) return null;
    minion.state = "chase";
  }
  const target = targetOf(world, minion);
  if (!target) {
    if (minion.state !== "follow") stopChasing(minion);
    follow(world, minion);
    return null;
  }
  if (minion.target !== target.id) {
    minion.path = [];
    minion.replan = 0;
  }
  minion.state = "chase";
  minion.target = target.id;
  chase(world, minion, target);
  return null;
}

/**
 * The Monster a Minion goes after: the one it is after while that one stays
 * within its Leash to the Hero, else the nearest to it of those within its
 * guard radius of the Hero; failing a Monster, a Bone Altar the same way.
 * None while it is so far from the Hero that it should teleport back to them.
 */
function targetOf(world: World, minion: Minion): Monster | BoneAltar | null {
  const tuning = minionTuning[minion.type];
  const hero = world.hero.pos;
  if (distance(minion.pos, hero) > tuning.teleportDistance) return null;
  const current = targetsOf(world).find((m) => m.id === minion.target);
  if (current && distance(current.pos, hero) <= tuning.leash) return current;
  const nearestOf = (targets: readonly (Monster | BoneAltar)[]) => {
    let nearest: Monster | BoneAltar | null = null;
    for (const target of targets) {
      if (distance(target.pos, hero) > tuning.guardRadius) continue;
      if (
        !nearest ||
        distance(minion.pos, target.pos) < distance(minion.pos, nearest.pos)
      ) {
        nearest = target;
      }
    }
    return nearest;
  };
  return nearestOf(world.monsters) ?? nearestOf(world.boneAltars);
}

/** Gives up on its Monster, to follow the Hero. */
function stopChasing(minion: Minion) {
  minion.state = "follow";
  minion.target = null;
  minion.path = [];
  minion.replan = 0;
  minion.stuck = 0;
}

/**
 * Walks to `monster`, stopping once in reach, and attacks when ready;
 * teleports next to the Hero when stuck for a while.
 */
function chase(world: World, minion: Minion, monster: Monster | BoneAltar) {
  const reach = minionTuning[minion.type].reach + altarRadiusOf(monster);
  const gap = distance(minion.pos, monster.pos);
  // A chase stops at reach only up to rounding.
  if (gap <= reach + 1e-9) {
    minion.path = [];
    minion.stuck = 0;
    if (minion.cooldown === 0) startWindUp(minion, monster.pos);
    return;
  }
  const radius = minionTuning[minion.type].radius;
  const spot = attackSpot(world, minion, radius, monster.pos, reach, [monster]);
  if (spot) {
    walkOrTeleport(world, minion, spot, distance(minion.pos, spot), monster);
    return;
  }
  // No spot free round it: another Monster within guard range, else wait
  // nearby, a body's width off the ones in reach.
  const other = anotherTarget(world, minion, monster);
  if (other) {
    minion.target = other.id;
    minion.path = [];
    minion.replan = 0;
    chase(world, minion, other);
    return;
  }
  const wait = reach + 2 * radius;
  if (gap <= wait) {
    minion.path = [];
    minion.stuck = 0;
    return;
  }
  walkOrTeleport(world, minion, monster.pos, gap - wait, monster);
}

/**
 * The nearest to `minion` of the Monsters within its guard radius of the
 * Hero, bar `except`, that has a free attack spot round it.
 */
function anotherTarget(
  world: World,
  minion: Minion,
  except: Monster | BoneAltar,
): Monster | null {
  const { guardRadius, reach, radius } = minionTuning[minion.type];
  let nearest: Monster | null = null;
  for (const monster of world.monsters) {
    if (monster === except) continue;
    if (distance(monster.pos, world.hero.pos) > guardRadius) continue;
    if (
      nearest &&
      distance(minion.pos, monster.pos) >= distance(minion.pos, nearest.pos)
    ) {
      continue;
    }
    if (attackSpot(world, minion, radius, monster.pos, reach, [monster])) {
      nearest = monster;
    }
  }
  return nearest;
}

/** Starts winding up an attack, facing its Monster at `at`. */
function startWindUp(minion: Minion, at: Vec) {
  minion.state = "windup";
  minion.attackSteps = 0;
  faceToward(minion, at);
}

/**
 * Winds up, rooted, and at its end resolves the attack: it lands on its
 * Monster only if it still lives, in reach, plus grace, and in the arc of the
 * facing it wound up in. Then it recovers, rooted, and waits a while longer
 * before it can attack again. Returns the Monster it lands on, if any.
 */
function windUp(world: World, minion: Minion): Monster | BoneAltar | null {
  const stepped = STEPPED[minion.type];
  minion.attackSteps += 1;
  if (minion.attackSteps < stepped.windUpSteps) return null;
  minion.state = "recover";
  minion.attackSteps = stepped.rootSteps;
  minion.cooldown = stepped.rootSteps + stepped.recoverySteps;
  const monster = targetsOf(world).find((m) => m.id === minion.target);
  if (!monster) return null;
  const { reach, reachGrace } = minionTuning[minion.type];
  return lands(
    minion,
    monster.pos,
    reach + reachGrace + altarRadiusOf(monster),
    stepped.arc,
  )
    ? monster
    : null;
}

/**
 * Walks after the Hero until within its follow distance with a clear line to
 * them, and teleports next to them when further than its teleport distance
 * or stuck for a while.
 */
function follow(world: World, minion: Minion) {
  const area = world.areas[world.areaName];
  const hero = world.hero.pos;
  const tuning = minionTuning[minion.type];
  const gap = distance(minion.pos, hero);
  if (gap > tuning.teleportDistance) {
    placeBesideHero(world, minion);
    return;
  }
  if (
    gap <= tuning.followDistance + 1e-9 &&
    isClear(area, minion.pos, hero, STEPPED[minion.type].gait.radius)
  ) {
    minion.path = [];
    minion.replan = 0;
    minion.stuck = 0;
    return;
  }
  walkOrTeleport(world, minion, hero, gap - tuning.followDistance);
}

/**
 * Walks up to `limit` towards `to`, around the Monsters in the way bar
 * `going`, the one it walks up to. It teleports next to the Hero once it has
 * hardly moved for a while: stuck where it can't walk to `to`, unless it is
 * fighting, so a Minion holding a line stays in it.
 */
function walkOrTeleport(
  world: World,
  minion: Minion,
  to: Vec,
  limit: number,
  going: Monster | BoneAltar | null = null,
) {
  const area = world.areas[world.areaName];
  const stepped = STEPPED[minion.type];
  const from = minion.pos;
  const gait: Gait = {
    ...stepped.gait,
    body: {
      radius: minionTuning[minion.type].radius,
      obstacles: monsterBodies(world, going),
    },
  };
  goToward(area, minion, gait, to, stepped.speed, limit);
  // A walk ending at the follow distance or in reach is over before this
  // adds up.
  // While fighting it is held, not stuck, so the count starts over once the
  // fight is done instead of teleporting it the moment that happens.
  if (
    isFighting(world, minion) ||
    distance(from, minion.pos) >= stepped.stuckStride
  ) {
    minion.stuck = 0;
  } else {
    minion.stuck += 1;
  }
  if (minion.stuck >= stepped.stuckSteps) placeBesideHero(world, minion);
}

/** Whether a Monster is close enough to the Minion to be fighting it. */
function isFighting(world: World, minion: Minion): boolean {
  const { reach, radius, fightRange } = minionTuning[minion.type];
  return world.monsters.some(
    (monster) =>
      distance(minion.pos, monster.pos) <=
      reach + monsterTuning[monster.type].radius + radius + fightRange,
  );
}
