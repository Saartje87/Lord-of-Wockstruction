import {
  experienceDropOff,
  type MeleeTuning,
  type MonsterGrowth,
  type MonsterType,
  monsterTuning,
  type RangedTuning,
} from "../tuning/monsters";
import { uniqueTuning } from "../tuning/uniqueMonsters";
import { attackSpot, heroSideBodies, wallRadius } from "./bodies";
import { faceToward, lands } from "./melee";
import { canSee, isClear } from "./path";
import type { AttackNumbers } from "./projectiles";
import { random, randomInt } from "./random";
import { msToSteps, perStep } from "./units";
import { distance, type Vec } from "./vec";
import { type Gait, goToward, holdBack, walkAlong } from "./walking";
import type { Monster, MonsterTarget, World } from "./world";

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
      attack: steppedAttack(tuning.attack),
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
    attack: SteppedAttack;
  }
>;

/**
 * A Monster type's attack converted to steps: a melee one's arc in radians,
 * a ranged one's Projectile speed in tiles per step.
 */
type SteppedAttack =
  | { kind: "melee"; reach: number; reachGrace: number; arc: number }
  | (Omit<RangedTuning, "projectileSpeed"> & { projectileSpeed: number });

function steppedAttack(attack: MeleeTuning | RangedTuning): SteppedAttack {
  if (attack.kind === "ranged") {
    return { ...attack, projectileSpeed: perStep(attack.projectileSpeed) };
  }
  const { reach, reachGrace, arcDegrees } = attack;
  return {
    kind: "melee",
    reach,
    reachGrace,
    arc: (arcDegrees * Math.PI) / 180,
  };
}

/**
 * A Monster type at a Monster Level, and whether it is a Unique Monster: all
 * its scaled numbers depend on.
 */
export type MonsterOfLevel = Pick<Monster, "type" | "monsterLevel"> & {
  unique?: Monster["unique"];
};

/** `value` times `factor` when the Monster is a Unique Monster, rounded. */
function uniquely(
  { unique }: MonsterOfLevel,
  value: number,
  factor: number,
): number {
  return unique ? Math.round(value * factor) : value;
}

/**
 * A Monster Level 1 number grown by `rate` of itself for each Monster Level
 * above 1, rounded to a whole number.
 */
function grown(value: number, rate: number, monsterLevel: number): number {
  return Math.round(value * (1 + rate * (monsterLevel - 1)));
}

/** A one-number tuning value that grows with Monster Level. */
type GrowingStat = Exclude<keyof MonsterGrowth, "damage">;

/** A Monster type's `stat` grown to its Monster Level. */
function grownStat(
  { type, monsterLevel }: MonsterOfLevel,
  stat: GrowingStat,
): number {
  const tuning = monsterTuning[type];
  return grown(tuning[stat], tuning.growth[stat], monsterLevel);
}

/** A Monster's max Life at its Monster Level. */
export function monsterMaxLife(monster: MonsterOfLevel): number {
  return uniquely(monster, grownStat(monster, "life"), uniqueTuning.life);
}

/** The least and most damage a Monster's hit deals at its Monster Level. */
export function monsterDamageRange(monster: MonsterOfLevel): [number, number] {
  const { type, monsterLevel } = monster;
  const { damage, growth } = monsterTuning[type];
  return [
    uniquely(
      monster,
      grown(damage[0], growth.damage, monsterLevel),
      uniqueTuning.damage,
    ),
    uniquely(
      monster,
      grown(damage[1], growth.damage, monsterLevel),
      uniqueTuning.damage,
    ),
  ];
}

/** A Monster's Attack Rating at its Monster Level. */
export function monsterAttackRating(monster: MonsterOfLevel): number {
  return uniquely(
    monster,
    grownStat(monster, "attackRating"),
    uniqueTuning.attackRating,
  );
}

/** A Monster's Defense at its Monster Level. */
export function monsterDefense(monster: MonsterOfLevel): number {
  return grownStat(monster, "defense");
}

/** The Experience killing a Monster is worth at its Monster Level. */
export function monsterExperience(monster: MonsterOfLevel): number {
  return uniquely(
    monster,
    grownStat(monster, "experience"),
    uniqueTuning.experience,
  );
}

/**
 * The Experience a Hero of Level `heroLevel` gains for killing a Monster: its
 * Experience times the drop-off for how far its Monster Level is below the
 * Hero's Level, rounded to a whole number.
 */
export function killExperience(
  monster: MonsterOfLevel,
  heroLevel: number,
): number {
  const below = Math.max(0, heroLevel - monster.monsterLevel);
  const factor =
    experienceDropOff[Math.min(below, experienceDropOff.length - 1)];
  return Math.round(monsterExperience(monster) * factor);
}

/** The numbers a Monster's attacks roll with at its Monster Level. */
export function monsterAttack(monster: MonsterOfLevel): AttackNumbers {
  return {
    attackRating: monsterAttackRating(monster),
    damage: monsterDamageRange(monster),
  };
}

/** A Monster's attack landing on its target this step. */
export type Strike = { monster: Monster; target: MonsterTarget };

/**
 * Moves every Monster one step: noticing, chasing, attacking, walking home
 * and wearing its Curse down. Returns the attacks that land on the Hero or
 * their Minions this step.
 */
export function stepMonsters(world: World): Strike[] {
  const strikes: Strike[] = [];
  for (const monster of world.monsters) {
    if (monster.grace > 0) monster.grace -= 1;
    if (monster.cooldown > 0) monster.cooldown -= 1;
    if (monster.curse) {
      monster.curse.left -= 1;
      if (monster.curse.left <= 0) monster.curse = null;
    }
    if (monster.state === "windup") {
      if (windUp(world, monster)) {
        strikes.push({ monster, target: monster.target });
      }
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
  return strikes;
}

/** A Monster the Hero hits notices them, unless it is walking home. */
export function noticeHit(world: World, monster: Monster) {
  if (isStrolling(monster)) notice(world, monster);
}

/**
 * Sends a Monster after the Hero or their Minions, waking the strolling
 * Monsters near it that aren't in their grace period. Those it wakes don't
 * wake others in turn.
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

/** Who a Monster can go after, and where they stand. */
type Quarry = { target: MonsterTarget; pos: Vec };

/** The Hero, while alive, and each of their Minions. */
function quarriesOf(world: World): Quarry[] {
  const quarries: Quarry[] = [];
  if (!world.death) quarries.push({ target: "hero", pos: world.hero.pos });
  for (const minion of world.minions) {
    quarries.push({ target: minion.id, pos: minion.pos });
  }
  return quarries;
}

/**
 * The nearest to the Monster of the Hero and their Minions, the Hero on a
 * tie, or null with none there.
 */
function nearestQuarry(world: World, monster: Monster): Quarry | null {
  let nearest: Quarry | null = null;
  for (const quarry of quarriesOf(world)) {
    if (
      !nearest ||
      distance(monster.pos, quarry.pos) < distance(monster.pos, nearest.pos)
    ) {
      nearest = quarry;
    }
  }
  return nearest;
}

/** Where a Monster's target stands, or null when it's gone. */
function targetPos(world: World, target: MonsterTarget): Vec | null {
  if (target === "hero") return world.death ? null : world.hero.pos;
  return world.minions.find((minion) => minion.id === target)?.pos ?? null;
}

/**
 * Whether the Monster can see the living Hero or one of their Minions near
 * enough to go after them.
 */
function sees(world: World, monster: Monster): boolean {
  const tuning = monsterTuning[monster.type];
  const area = world.areas[world.areaName];
  return quarriesOf(world).some(
    ({ pos }) =>
      distance(monster.pos, pos) <= tuning.aggroRadius &&
      (!tuning.needsSight || canSee(area, monster.pos, pos)),
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
  const { wanderRadius } = monsterTuning[monster.type];
  const angle = random(world.rng) * 2 * Math.PI;
  const reach = random(world.rng) * wanderRadius;
  const goal = {
    x: monster.home.x + reach * Math.cos(angle),
    y: monster.home.y + reach * Math.sin(angle),
  };
  const area = world.areas[world.areaName];
  if (!isClear(area, monster.pos, goal, gaitOf(world, monster).radius)) return;
  monster.state = "wander";
  monster.path = [goal];
}

/**
 * Strolls to its wander point, then pauses there. It pauses where it stands
 * instead once pushed off the clear line to the point.
 */
function wander(world: World, monster: Monster) {
  const area = world.areas[world.areaName];
  if (
    isClear(area, monster.pos, monster.path[0], gaitOf(world, monster).radius)
  ) {
    const before = monster.pos;
    const gait = gaitOf(world, monster);
    walkAlong(monster, monster.path, STEPPED[monster.type].wanderSpeed);
    holdBack(area, monster, before, gait);
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

/**
 * Goes after the nearest of the Hero and their Minions, stopping once in
 * reach, or gives up beyond its leash.
 */
function chase(world: World, monster: Monster) {
  const { leash } = monsterTuning[monster.type];
  const { attack } = STEPPED[monster.type];
  if (distance(monster.pos, monster.home) > leash) {
    sendHome(monster);
    return;
  }
  const quarry = nearestQuarry(world, monster);
  if (!quarry) return;
  monster.target = quarry.target;
  const area = world.areas[world.areaName];
  const gap = distance(monster.pos, quarry.pos);
  // A ranged Monster stops only where it can also see its target, and walks
  // on, behind a wall, until it can.
  const ranged = attack.kind === "ranged";
  const stopAt = ranged ? attack.range : attack.reach;
  const inSight = !ranged || canSee(area, monster.pos, quarry.pos);
  // A chase stops at reach only up to rounding.
  if (gap <= stopAt + 1e-9 && inSight) {
    monster.path = [];
    if (canWindUp(world, monster)) startWindUp(monster, quarry.pos);
    return;
  }
  const going = quarryBody(world, quarry.target);
  const gait = gaitOf(world, monster, going);
  if (!ranged && going) {
    // Heads for a free spot round its target within reach; with none free it
    // waits nearby, a body's width off.
    const { radius } = monsterTuning[monster.type];
    const spot = attackSpot(world, monster, radius, quarry.pos, stopAt, [
      going,
    ]);
    if (spot) {
      goToward(
        area,
        monster,
        gait,
        spot,
        STEPPED[monster.type].speed,
        distance(monster.pos, spot),
      );
      return;
    }
    const wait = stopAt + 2 * radius;
    if (gap <= wait) {
      monster.path = [];
      return;
    }
    goToward(
      area,
      monster,
      gait,
      quarry.pos,
      STEPPED[monster.type].speed,
      gap - wait,
    );
    return;
  }
  goToward(
    area,
    monster,
    gait,
    quarry.pos,
    STEPPED[monster.type].speed,
    inSight ? gap - stopAt : gap,
  );
}

/** Gives up on the Hero and their Minions and walks home. */
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

/** How far through its recovery a recovering Monster is, from 0 to 1. */
export function recoveryProgress(monster: Monster): number {
  return 1 - monster.attack / STEPPED[monster.type].rootSteps;
}

/** Starts telegraphing an attack, facing its target at `at`. */
function startWindUp(monster: Monster, at: Vec) {
  monster.state = "windup";
  monster.attack = 0;
  faceToward(monster, at);
}

/**
 * Winds up, rooted, and at its end resolves the attack: a melee one hits its
 * target only if it is still there, in reach, plus grace, and in the arc of
 * the facing it wound up in; a ranged one looses a Projectile at where its
 * target is then. Then it recovers, rooted, and waits a while longer, with
 * some jitter, before it can attack again. Returns whether a melee attack hit.
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
  const { attack } = stepped;
  const at = targetPos(world, monster.target);
  if (!at) return false;
  if (attack.kind === "ranged") {
    loose(world, monster, attack, at);
    return false;
  }
  return lands(monster, at, attack.reach + attack.reachGrace, attack.arc);
}

/** Looses a ranged Monster's Projectile from where it stands at `at`. */
function loose(
  world: World,
  monster: Monster,
  ranged: Extract<SteppedAttack, { kind: "ranged" }>,
  at: Vec,
) {
  faceToward(monster, at);
  world.projectiles.push({
    kind: ranged.projectile,
    pos: { ...monster.pos },
    prevPos: { ...monster.pos },
    direction: { x: Math.cos(monster.facing), y: Math.sin(monster.facing) },
    speed: ranged.projectileSpeed,
    rangeLeft: ranged.projectileRange,
    from: monster.id,
    ...monsterAttack(monster),
  });
}

/**
 * Walks home, ignoring the Hero and their Minions, and on arrival heals to
 * full, loses its Curse and starts a grace period before it can notice
 * either again.
 */
function goHome(world: World, monster: Monster) {
  const area = world.areas[world.areaName];
  const stepped = STEPPED[monster.type];
  goToward(
    area,
    monster,
    gaitOf(world, monster),
    monster.home,
    stepped.returnSpeed,
  );
  if (distance(monster.pos, monster.home) > 0) return;
  monster.state = "idle";
  monster.life = monsterMaxLife(monster);
  monster.curse = null;
  monster.grace = stepped.graceSteps;
}

/**
 * A Monster walks with its type's radius, capped at the Hero's against
 * walls, and its type's re-plan timer.
 */
function gaitOf(
  world: World,
  monster: Monster,
  going: object | null = null,
): Gait {
  const { radius } = monsterTuning[monster.type];
  return {
    radius: wallRadius(radius),
    replanSteps: STEPPED[monster.type].replanSteps,
    body: { radius, obstacles: heroSideBodies(world, going) },
  };
}

/** The Hero or Minion a target is. */
function quarryBody(world: World, target: MonsterTarget): object | null {
  if (target === "hero") return world.hero;
  return world.minions.find((minion) => minion.id === target) ?? null;
}
