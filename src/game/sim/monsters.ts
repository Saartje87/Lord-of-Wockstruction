import { heroTuning } from "../tuning/hero";
import { type MonsterType, monsterTuning } from "../tuning/monsters";
import { type Area, isWalkable } from "./area";
import { canSee, findPath, isClear } from "./path";
import { random, randomInt } from "./random";
import { msToSteps, perStep } from "./units";
import { angleBetween, distance, type Vec } from "./vec";
import type { Monster, World } from "./world";

/** Each Monster type's tuning converted to steps. */
const STEPPED = Object.fromEntries(
  Object.entries(monsterTuning).map(([type, tuning]) => [
    type,
    {
      speed: perStep(tuning.speed),
      returnSpeed: perStep(tuning.speed * tuning.returnSpeed),
      replanSteps: msToSteps(tuning.replanMs),
      graceSteps: msToSteps(tuning.graceMs),
      wanderSpeed: perStep(tuning.speed * tuning.wanderSpeed),
      pauseSteps: tuning.wanderPauseMs.map(msToSteps) as [number, number],
      windUpSteps: msToSteps(tuning.windUpMs),
      rootSteps: msToSteps(tuning.rootMs),
      recoverySteps: msToSteps(tuning.recoveryMs),
      jitterSteps: msToSteps(tuning.jitterMs),
      arc: (tuning.arcDegrees * Math.PI) / 180,
    },
  ]),
) as Record<
  MonsterType,
  {
    speed: number;
    returnSpeed: number;
    replanSteps: number;
    graceSteps: number;
    wanderSpeed: number;
    pauseSteps: [number, number];
    windUpSteps: number;
    rootSteps: number;
    recoverySteps: number;
    jitterSteps: number;
    arc: number;
  }
>;

/** A Monster type at a Monster Level: all its scaled numbers depend on. */
export type MonsterOfLevel = Pick<Monster, "type" | "level">;

/**
 * A Monster Level 1 number grown by `rate` of itself for each Monster Level
 * above 1, rounded to a whole number.
 */
function grown(value: number, rate: number, level: number): number {
  return Math.round(value * (1 + rate * (level - 1)));
}

/** A Monster's max Life at its Monster Level. */
export function monsterMaxLife({ type, level }: MonsterOfLevel): number {
  const { life, growth } = monsterTuning[type];
  return grown(life, growth.life, level);
}

/** The least and most damage a Monster's hit deals at its Monster Level. */
export function monsterDamageRange({
  type,
  level,
}: MonsterOfLevel): [number, number] {
  const { damage, growth } = monsterTuning[type];
  return [
    grown(damage[0], growth.damage, level),
    grown(damage[1], growth.damage, level),
  ];
}

/** A Monster's Attack Rating at its Monster Level. */
export function monsterAttackRating({ type, level }: MonsterOfLevel): number {
  const { attackRating, growth } = monsterTuning[type];
  return grown(attackRating, growth.attackRating, level);
}

/** A Monster's Defense at its Monster Level. */
export function monsterDefense({ type, level }: MonsterOfLevel): number {
  const { defense, growth } = monsterTuning[type];
  return grown(defense, growth.defense, level);
}

/** The Experience killing a Monster is worth at its Monster Level. */
export function monsterExperience({ type, level }: MonsterOfLevel): number {
  const { experience, growth } = monsterTuning[type];
  return grown(experience, growth.experience, level);
}

/**
 * Moves every Monster one step: noticing, chasing, attacking and walking
 * home. Returns the Monsters whose attack hits the Hero this step.
 */
export function stepMonsters(world: World): Monster[] {
  const strikers: Monster[] = [];
  for (const monster of world.monsters) {
    if (monster.grace > 0) monster.grace -= 1;
    if (monster.cooldown > 0) monster.cooldown -= 1;
    if (monster.state === "windup") {
      if (windUp(world, monster)) strikers.push(monster);
      continue;
    }
    if (monster.state === "recover") {
      monster.attack -= 1;
      if (monster.attack > 0) continue;
      monster.state = "chase";
    }
    // A flinch roots it.
    if (monster.flinch > 0) continue;
    if (isStrolling(monster) && monster.grace === 0 && sees(world, monster)) {
      notice(world, monster);
      continue;
    }
    switch (monster.state) {
      case "idle":
        rest(world, monster);
        break;
      case "wander":
        wander(world, monster);
        break;
      case "chase":
        chase(world, monster);
        break;
      case "return":
        goHome(world, monster);
        break;
    }
  }
  separate(world);
  return strikers;
}

/** A Monster the Hero hits notices them, unless it is walking home. */
export function noticeHit(world: World, monster: Monster) {
  if (isStrolling(monster)) notice(world, monster);
}

/**
 * Sends a Monster after the Hero, waking the strolling Monsters near it that
 * aren't in their grace period. Those it wakes don't wake others in turn.
 */
function notice(world: World, monster: Monster) {
  wake(monster);
  const { spreadRadius } = monsterTuning[monster.type];
  for (const other of world.monsters) {
    if (
      isStrolling(other) &&
      other.grace === 0 &&
      distance(other.pos, monster.pos) <= spreadRadius
    ) {
      wake(other);
    }
  }
}

function wake(monster: Monster) {
  monster.state = "chase";
  monster.path = [];
  monster.replan = 0;
}

function isStrolling(monster: Monster): boolean {
  return monster.state === "idle" || monster.state === "wander";
}

/**
 * Whether the Monster can see the Hero near enough to go after them, and
 * they're alive.
 */
function sees(world: World, monster: Monster): boolean {
  if (world.death) return false;
  const tuning = monsterTuning[monster.type];
  const { pos } = world.hero;
  if (distance(monster.pos, pos) > tuning.aggroRadius) return false;
  return (
    !tuning.needsSight || canSee(world.areas[world.areaName], monster.pos, pos)
  );
}

/**
 * Waits out its pause, then picks a point within its wander radius of home
 * that it can stroll to in a straight line. Where the point it tries isn't
 * one, it tries again next step.
 */
function rest(world: World, monster: Monster) {
  if (monster.pause > 0) {
    monster.pause -= 1;
    return;
  }
  const { wanderRadius, radius } = monsterTuning[monster.type];
  const angle = random(world.rng) * 2 * Math.PI;
  const reach = random(world.rng) * wanderRadius;
  const goal = {
    x: monster.home.x + reach * Math.cos(angle),
    y: monster.home.y + reach * Math.sin(angle),
  };
  const area = world.areas[world.areaName];
  if (!isClear(area, monster.pos, goal, radius)) return;
  monster.state = "wander";
  monster.path = [goal];
}

/**
 * Strolls to its wander point, then pauses there. It pauses where it stands
 * instead once pushed off the clear line to the point.
 */
function wander(world: World, monster: Monster) {
  const area = world.areas[world.areaName];
  const { radius } = monsterTuning[monster.type];
  if (isClear(area, monster.pos, monster.path[0], radius)) {
    walkAlong(monster, monster.path, STEPPED[monster.type].wanderSpeed);
    if (monster.path.length > 0) return;
  }
  monster.state = "idle";
  monster.path = [];
  monster.pause = wanderPause(world, monster.type);
}

/** A random pause between strolls, in steps. */
export function wanderPause(world: World, type: MonsterType): number {
  return randomInt(world.rng, STEPPED[type].pauseSteps);
}

/** Goes after the Hero, stopping once in reach, or gives up beyond its leash. */
function chase(world: World, monster: Monster) {
  const { reach, leash } = monsterTuning[monster.type];
  if (distance(monster.pos, monster.home) > leash) {
    sendHome(monster);
    return;
  }
  const hero = world.hero.pos;
  const gap = distance(monster.pos, hero);
  // A chase stops at reach only up to rounding.
  if (gap <= reach + 1e-9) {
    monster.path = [];
    if (canWindUp(world, monster)) startWindUp(monster, hero);
    return;
  }
  const area = world.areas[world.areaName];
  goToward(area, monster, hero, STEPPED[monster.type].speed, gap - reach);
}

/** Gives up on the Hero and walks home. */
export function sendHome(monster: Monster) {
  monster.state = "return";
  monster.path = [];
  monster.replan = 0;
}

/** Whether it is ready to attack, with room under its type's attacker cap. */
function canWindUp(world: World, monster: Monster): boolean {
  if (monster.cooldown > 0) return false;
  const { maxAttackers } = monsterTuning[monster.type];
  if (maxAttackers === 0) return true;
  const attackers = world.monsters.filter(
    (other) => other.type === monster.type && other.state === "windup",
  );
  return attackers.length < maxAttackers;
}

/** How far through its wind-up a winding-up Monster is, from 0 to 1. */
export function windUpProgress(monster: Monster): number {
  return monster.attack / STEPPED[monster.type].windUpSteps;
}

/** Starts telegraphing an attack, facing the Hero. */
function startWindUp(monster: Monster, hero: Vec) {
  monster.state = "windup";
  monster.attack = 0;
  const dx = hero.x - monster.pos.x;
  const dy = hero.y - monster.pos.y;
  if (dx !== 0 || dy !== 0) monster.facing = Math.atan2(dy, dx);
}

/**
 * Winds up, rooted, and at its end resolves the attack: it hits the Hero
 * only if they are still in reach, plus grace, and in the arc of the facing
 * it wound up in. Then it recovers, rooted, and waits a while longer, with
 * some jitter, before it can attack again. Returns whether it hit.
 */
function windUp(world: World, monster: Monster): boolean {
  const stepped = STEPPED[monster.type];
  monster.attack += 1;
  if (monster.attack < stepped.windUpSteps) return false;
  monster.state = "recover";
  monster.attack = stepped.rootSteps;
  monster.cooldown =
    stepped.rootSteps +
    stepped.recoverySteps +
    randomInt(world.rng, [0, stepped.jitterSteps]);
  const { reach, reachGrace } = monsterTuning[monster.type];
  const hero = world.hero.pos;
  const gap = distance(monster.pos, hero);
  if (gap > reach + reachGrace) return false;
  if (gap === 0) return true;
  const angle = Math.atan2(hero.y - monster.pos.y, hero.x - monster.pos.x);
  return angleBetween(angle, monster.facing) <= STEPPED[monster.type].arc;
}

/**
 * Walks home, ignoring the Hero, and on arrival heals to full and starts a
 * grace period before it can notice the Hero again.
 */
function goHome(world: World, monster: Monster) {
  const area = world.areas[world.areaName];
  const stepped = STEPPED[monster.type];
  goToward(area, monster, monster.home, stepped.returnSpeed);
  if (distance(monster.pos, monster.home) > 0) return;
  monster.state = "idle";
  monster.life = monsterMaxLife(monster);
  monster.grace = stepped.graceSteps;
}

/**
 * Walks up to `budget` towards `to`: straight along a clear line, otherwise
 * along an A* path around walls, re-planned every so often as `to` moves.
 * `limit` caps a straight walk, so it can stop exactly short of `to`.
 */
function goToward(
  area: Area,
  monster: Monster,
  to: Vec,
  budget: number,
  limit = Number.POSITIVE_INFINITY,
) {
  const { radius } = monsterTuning[monster.type];
  if (isClear(area, monster.pos, to, radius)) {
    monster.path = [];
    monster.replan = 0;
    walkAlong(monster, [to], Math.min(budget, limit));
    return;
  }
  // Only on the timer, even with the path walked: where `to` can't be
  // reached, the path ends short of it, and re-planning there every step
  // would find the same path.
  monster.replan -= 1;
  if (monster.replan <= 0) {
    monster.path = findPath(area, monster.pos, to, radius);
    monster.replan = STEPPED[monster.type].replanSteps;
  }
  walkAlong(monster, monster.path, budget);
}

/**
 * Moves the Monster up to `budget` through `points` in order, dropping each
 * one it reaches, and faces the way it walks.
 */
function walkAlong(monster: Monster, points: Vec[], budget: number) {
  while (budget > 0 && points.length > 0) {
    const next = points[0];
    const dx = next.x - monster.pos.x;
    const dy = next.y - monster.pos.y;
    const gap = Math.hypot(dx, dy);
    if (gap > 0) monster.facing = Math.atan2(dy, dx);
    if (gap <= budget) {
      monster.pos = { ...next };
      points.shift();
      budget -= gap;
    } else {
      monster.pos = {
        x: monster.pos.x + (dx / gap) * budget,
        y: monster.pos.y + (dy / gap) * budget,
      };
      budget = 0;
    }
  }
}

/**
 * Pushes overlapping Monsters apart, and out of the Hero, as circles. The Hero
 * is never moved. A push into a wall slides along it, keeping only the part
 * along whichever axis is open.
 */
function separate(world: World) {
  const area = world.areas[world.areaName];
  const hero = world.hero.pos;
  const push = (monster: Monster, by: Vec) => {
    const { x, y } = monster.pos;
    const to = [
      { x: x + by.x, y: y + by.y },
      { x: x + by.x, y },
      { x, y: y + by.y },
    ].find((point) => isWalkable(area, point));
    if (to) monster.pos = to;
  };

  for (const [i, a] of world.monsters.entries()) {
    const { radius } = monsterTuning[a.type];
    const overlap = radius + heroTuning.radius - distance(a.pos, hero);
    if (overlap > 0) push(a, scaled(away(hero, a.pos, a.id), overlap));

    for (const b of world.monsters.slice(i + 1)) {
      const apart = radius + monsterTuning[b.type].radius;
      const overlap = apart - distance(a.pos, b.pos);
      if (overlap <= 0) continue;
      const out = away(a.pos, b.pos, b.id);
      push(a, scaled(out, -overlap / 2));
      push(b, scaled(out, overlap / 2));
    }
  }
}

/**
 * The unit vector from `from` to `to`, or, where they coincide, a direction
 * picked from `id` so the two still part the same way every replay.
 */
function away(from: Vec, to: Vec, id: number): Vec {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length > 0) return { x: dx / length, y: dy / length };
  return { x: Math.cos(id), y: Math.sin(id) };
}

const scaled = (v: Vec, by: number): Vec => ({ x: v.x * by, y: v.y * by });
