import { graveWockingtonTuning } from "../tuning/graveWockington";
import {
  experienceDropOff,
  type MeleeTuning,
  type MonsterGrowth,
  type MonsterType,
  monsterTuning,
  type RangedTuning,
} from "../tuning/monsters";
import { skillTuning } from "../tuning/skills";
import { uniqueTuning } from "../tuning/uniqueMonsters";
import { attackSpot, heroSideBodies, wallRadius } from "./bodies";
import { BONE_WALL_HALF, type BoneWallPiece } from "./boneWalls";
import { faceToward, lands, targetsInCircle } from "./melee";
import { canReach, canSee, isClear } from "./path";
import type { AttackNumbers } from "./projectiles";
import { random, randomInt } from "./random";
import { msToSteps, perStep } from "./units";
import { distance, type Vec } from "./vec";
import {
  type Gait,
  goToward,
  holdBack,
  stepInDirection,
  walkAlong,
} from "./walking";
import type { Monster, MonsterTarget, SimEvent, World } from "./world";

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
  | {
      kind: "melee";
      reach: number;
      reachGrace: number;
      arc: number;
      slam?: { radius: number };
    }
  | (Omit<RangedTuning, "projectileSpeed" | "melee" | "recoveryMs"> & {
      projectileSpeed: number;
      /** The swing it makes instead with its target within its reach. */
      melee?: SteppedMelee;
      /** Its recovery at each stage, in steps. */
      recovery?: number[];
    });

type SteppedMelee = Extract<SteppedAttack, { kind: "melee" }>;

function steppedAttack(attack: MeleeTuning | RangedTuning): SteppedAttack {
  if (attack.kind === "ranged") {
    const { melee, recoveryMs, ...rest } = attack;
    return {
      ...rest,
      projectileSpeed: perStep(attack.projectileSpeed),
      melee: melee && steppedAttack({ kind: "melee", ...melee }),
      recovery: recoveryMs?.map(msToSteps),
    } as SteppedAttack;
  }
  const { reach, reachGrace, arcDegrees, slam } = attack;
  return {
    kind: "melee",
    reach,
    reachGrace,
    arc: (arcDegrees * Math.PI) / 180,
    slam,
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

/**
 * A Monster's max Life at its Monster Level: a Unique Monster's times
 * `uniqueTuning.life`, the Act Boss's times his own `graveWockingtonTuning.life`.
 */
export function monsterMaxLife(monster: MonsterOfLevel): number {
  const factor =
    monster.type === "grave_wockington"
      ? graveWockingtonTuning.life
      : uniqueTuning.life;
  return uniquely(monster, grownStat(monster, "life"), factor);
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

/**
 * The numbers a Monster's attacks roll with at its Monster Level, its damage
 * cut by a Weaken Curse. This is the one place Monster damage is Weakened:
 * a swing and an Arrow (whose numbers are fixed as it is loosed) both take
 * their numbers from here.
 */
export function monsterAttack(
  monster: MonsterOfLevel & { curse?: Monster["curse"] },
): AttackNumbers {
  const dealt = cursedWith(monster.curse, "weaken")?.damageDealt ?? 1;
  const weakened = (damage: number) =>
    dealt === 1 ? damage : Math.max(1, Math.round(damage * dealt));
  const [least, most] = monsterDamageRange(monster);
  const { damageTypes } = monsterTuning[monster.type];
  return {
    attackRating: monsterAttackRating(monster),
    damage: [weakened(least), weakened(most)],
    ...(damageTypes && { damageTypes }),
  };
}

/** The tuning of the Curse `kind` a Monster is under, or null if not under it. */
function cursedWith<Kind extends "weaken" | "leadenLimbs">(
  curse: Monster["curse"] | undefined,
  kind: Kind,
) {
  if (!curse) return null;
  const { effect } = skillTuning[curse.skill];
  return effect.type === "curse" && effect.kind === kind
    ? (effect as Extract<typeof effect, { kind: Kind }>)
    : null;
}

/**
 * What share of its speed a Monster walks at: the slower of its Leaden Limbs
 * Curse and its Chill, never the two multiplied.
 */
function walkPace(monster: Pick<Monster, "curse" | "chill">): number {
  return slowerPace(monster, "walkSpeed");
}

/** What share as often a Monster swings or shoots, paced as `walkPace`. */
function attackPace(monster: Pick<Monster, "curse" | "chill">): number {
  return slowerPace(monster, "attackSpeed");
}

/** The slower of a Monster's Leaden Limbs and Chill shares of one pace. */
function slowerPace(
  monster: Pick<Monster, "curse" | "chill">,
  pace: "walkSpeed" | "attackSpeed",
): number {
  return Math.min(
    cursedWith(monster.curse, "leadenLimbs")?.[pace] ?? 1,
    monster.chill?.[pace] ?? 1,
  );
}

/**
 * A Monster's attack landing this step: on its target, or, with `wall` set,
 * on the Bone Wall piece it was attacking instead.
 */
export type Strike = {
  monster: Monster;
  target: MonsterTarget;
  wall: BoneWallPiece | null;
};

/**
 * Moves every Monster one step: noticing, chasing, attacking, walking home
 * and wearing its Curse down. Returns the attacks that land on the Hero or
 * their Minions this step.
 */
export function stepMonsters(world: World, events: SimEvent[]): Strike[] {
  const strikes: Strike[] = [];
  for (const monster of world.monsters) {
    if (monster.grace > 0) monster.grace -= 1;
    if (monster.cooldown > 0) monster.cooldown -= 1;
    if (monster.chill) {
      monster.chill.left -= 1;
      if (monster.chill.left <= 0) monster.chill = null;
    }
    if (monster.curse) {
      monster.curse.left -= 1;
      if (monster.curse.left <= 0) {
        monster.curse = null;
        // A Monster whose Dread ends takes up the fight again.
        if (monster.state === "flee") wake(monster);
      }
    }
    if (monster.state === "windup") {
      strikes.push(...windUp(world, monster, events));
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
      case "flee":
        flee(world, monster);
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
type TargetAt = { target: MonsterTarget; pos: Vec };

/** The Hero, while alive, and each of their Minions. */
function targetsAt(world: World): TargetAt[] {
  const targets: TargetAt[] = [];
  if (!world.death) targets.push({ target: "hero", pos: world.hero.pos });
  for (const minion of world.minions) {
    targets.push({ target: minion.id, pos: minion.pos });
  }
  return targets;
}

/**
 * The nearest to the Monster of the Hero and their Minions, the Hero on a
 * tie, or null with none there.
 */
function nearestTarget(world: World, monster: Monster): TargetAt | null {
  let nearest: TargetAt | null = null;
  for (const chased of targetsAt(world)) {
    if (
      !nearest ||
      distance(monster.pos, chased.pos) < distance(monster.pos, nearest.pos)
    ) {
      nearest = chased;
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
  return targetsAt(world).some(
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
    walkAlong(
      monster,
      monster.path,
      STEPPED[monster.type].wanderSpeed * walkPace(monster),
    );
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
  const chased = nearestTarget(world, monster);
  if (!chased) return;
  monster.target = chased.target;
  monster.wall = null;
  const area = world.areas[world.areaName];
  // A melee Monster a Bone Wall cuts off from its target attacks the Wall.
  if (
    attack.kind === "melee" &&
    world.boneWalls.length > 0 &&
    !canReach(area, monster.pos, chased.pos)
  ) {
    attackWall(world, monster, attack.reach);
    return;
  }
  const gap = distance(monster.pos, chased.pos);
  // A ranged Monster stops only where it can also see its target, and walks
  // on, behind a wall, until it can.
  const ranged = attack.kind === "ranged";
  const stopAt = ranged ? attack.range : attack.reach;
  const inSight = !ranged || canSee(area, monster.pos, chased.pos);
  // One that also swings does so with its target within that reach instead.
  const swing = ranged ? attack.melee : undefined;
  if (swing && gap <= swing.reach + 1e-9) {
    monster.path = [];
    if (canWindUp(world, monster)) startWindUp(monster, chased.pos, true);
    return;
  }
  // A chase stops at reach only up to rounding.
  if (gap <= stopAt + 1e-9 && inSight) {
    monster.path = [];
    if (canWindUp(world, monster)) startWindUp(monster, chased.pos);
    return;
  }
  const going = targetBody(world, chased.target);
  const gait = gaitOf(world, monster, going);
  if (!ranged && going) {
    // Heads for a free spot round its target within reach; with none free it
    // waits nearby, a body's width off.
    const { radius } = monsterTuning[monster.type];
    const spot = attackSpot(world, monster, radius, chased.pos, stopAt, [
      going,
    ]);
    if (spot) {
      goToward(
        area,
        monster,
        gait,
        spot,
        STEPPED[monster.type].speed * walkPace(monster),
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
      chased.pos,
      STEPPED[monster.type].speed * walkPace(monster),
      gap - wait,
    );
    return;
  }
  goToward(
    area,
    monster,
    gait,
    chased.pos,
    STEPPED[monster.type].speed * walkPace(monster),
    inSight ? gap - stopAt : gap,
  );
}

/** The Bone Wall piece `monster` is attacking, if it still stands. */
function attackedWall(world: World, monster: Monster): BoneWallPiece | null {
  if (monster.wall === null) return null;
  return world.boneWalls.find((piece) => piece.id === monster.wall) ?? null;
}

/**
 * Walks up to the nearest Bone Wall piece and, once its edge is in reach,
 * winds up an attack on it.
 */
function attackWall(world: World, monster: Monster, reach: number) {
  const area = world.areas[world.areaName];
  let nearest = world.boneWalls[0];
  for (const piece of world.boneWalls) {
    if (distance(monster.pos, piece.pos) < distance(monster.pos, nearest.pos)) {
      nearest = piece;
    }
  }
  const gap = distance(monster.pos, nearest.pos) - BONE_WALL_HALF;
  // A swing at a piece is made at its edge, which is an attack's reach
  // from the middle only up to rounding.
  if (gap <= reach + 1e-9) {
    monster.path = [];
    monster.wall = nearest.id;
    if (canWindUp(world, monster)) startWindUp(monster, nearest.pos);
    return;
  }
  goToward(
    area,
    monster,
    gaitOf(world, monster),
    nearest.pos,
    STEPPED[monster.type].speed * walkPace(monster),
  );
}

/**
 * Runs from the nearest of the Hero and their Minions at its usual speed,
 * never attacking, and stands where it is cornered.
 */
function flee(world: World, monster: Monster) {
  const chased = nearestTarget(world, monster);
  if (!chased) return;
  const away = {
    x: monster.pos.x - chased.pos.x,
    y: monster.pos.y - chased.pos.y,
  };
  // On top of its target it runs whichever way.
  if (away.x === 0 && away.y === 0) away.x = 1;
  const area = world.areas[world.areaName];
  const budget = STEPPED[monster.type].speed * walkPace(monster);
  const to = stepInDirection(
    area,
    monster.pos,
    away,
    budget,
    gaitOf(world, monster).radius,
  );
  monster.path = [];
  monster.facing = Math.atan2(away.y, away.x);
  if (to) monster.pos = to;
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

/** Starts telegraphing an attack, facing its target at `at`; a swing if `swinging`. */
function startWindUp(monster: Monster, at: Vec, swinging = false) {
  monster.state = "windup";
  monster.swinging = swinging;
  monster.attack = 0;
  faceToward(monster, at);
}

/**
 * Winds up, rooted, and at its end resolves the attack, returning the Strikes
 * that land: a melee one hits its target only if it is still there, in reach,
 * plus grace, and in the arc of the facing it wound up in, or the Bone Wall
 * piece it was attacking if that is in reach; a Slam also hits everything of
 * the Hero's in its circle, wall or no wall; a ranged one looses a Projectile
 * at where its target is then. Then it recovers, rooted, and waits a while
 * longer, with some jitter, before it can attack again.
 */
function windUp(world: World, monster: Monster, events: SimEvent[]): Strike[] {
  const stepped = STEPPED[monster.type];
  monster.attack += 1;
  if (monster.attack < stepped.windUpSteps) return [];
  monster.state = "recover";
  monster.attack = stepped.rootSteps;
  const { attack } = stepped;
  // One with a swing and a ranged attack resolves the one it wound up.
  const swing =
    attack.kind === "melee"
      ? attack
      : monster.swinging
        ? (attack.melee ?? null)
        : null;
  const recoverySteps =
    swing === null && attack.kind === "ranged" && attack.recovery
      ? (attack.recovery[stageOf(monster)] ?? attack.recovery.at(-1) ?? 0)
      : stepped.recoverySteps;
  // Leaden Limbs stretches the whole cycle (wind-up included) by waiting
  // longer here, so the telegraph and animation lengths stay as they are.
  const cooldown =
    stepped.rootSteps +
    recoverySteps +
    randomInt(world.rng, [0, stepped.jitterSteps]);
  monster.cooldown = Math.max(
    0,
    Math.round(
      (cooldown + stepped.windUpSteps) / attackPace(monster) -
        stepped.windUpSteps,
    ),
  );
  const strikes: Strike[] = [];
  if (attack.kind === "melee" && attack.slam) {
    for (const target of targetsInCircle(
      world,
      monster.pos,
      attack.slam.radius,
    )) {
      strikes.push({ monster, target, wall: null });
    }
  }
  if (monster.wall !== null) {
    const wall = attackedWall(world, monster);
    if (
      wall !== null &&
      attack.kind === "melee" &&
      lands(
        monster,
        wall.pos,
        attack.reach + attack.reachGrace + BONE_WALL_HALF,
        attack.arc,
      )
    ) {
      strikes.push({ monster, target: monster.target, wall });
    }
    return strikes;
  }
  if (attack.kind === "melee" && attack.slam) return strikes;
  // Gravefire lands where the Hero stands while they are in its caster's
  // range and sight, else where the Minion it is after stands.
  const atHero =
    swing === null &&
    attack.kind === "ranged" &&
    attack.lob?.atHero &&
    (monster.target === "hero" ||
      (distance(monster.pos, world.hero.pos) <= attack.range &&
        canSee(world.areas[world.areaName], monster.pos, world.hero.pos)));
  const at = atHero ? { ...world.hero.pos } : targetPos(world, monster.target);
  if (!at) return strikes;
  if (swing === null && attack.kind === "ranged") {
    loose(world, monster, attack, at, events);
  } else if (
    swing &&
    lands(monster, at, swing.reach + swing.reachGrace, swing.arc) &&
    canSee(world.areas[world.areaName], monster.pos, at)
  ) {
    strikes.push({ monster, target: monster.target, wall: null });
  }
  return strikes;
}

/**
 * Which stage of its fight a Monster is in, from 0: the index into numbers
 * tuned per stage. Grave Wockington's second is past half his Life; every
 * other Monster stays in its first.
 */
function stageOf(monster: Monster): number {
  return monster.waves?.stage ?? 0;
}

/** Looses a ranged Monster's Projectile from where it stands at `at`. */
function loose(
  world: World,
  monster: Monster,
  ranged: Extract<SteppedAttack, { kind: "ranged" }>,
  at: Vec,
  events: SimEvent[],
) {
  faceToward(monster, at);
  const flying = {
    kind: ranged.projectile,
    pos: { ...monster.pos },
    prevPos: { ...monster.pos },
    direction: { x: Math.cos(monster.facing), y: Math.sin(monster.facing) },
    from: monster.id,
    ...monsterAttack(monster),
    ...(ranged.damageTypes && { damageTypes: ranged.damageTypes }),
  };
  if (ranged.lob) {
    // Lobbed at the spot the target stands on now, not along a line.
    const gap = distance(monster.pos, at);
    const { burn } = ranged.lob;
    world.projectiles.push({
      ...flying,
      // A burning circle hits for a share of the blow each time.
      ...(burn && { damage: shareOfRange(flying.damage, burn.damage) }),
      lob: true,
      origin: { ...monster.pos },
      landing: { ...at },
      radius: ranged.lob.radius,
      progress: 0,
      rate: gap === 0 ? 1 : ranged.projectileSpeed / gap,
      ...(burn && {
        burn: { steps: msToSteps(burn.burnMs), every: msToSteps(burn.tickMs) },
      }),
    });
    if (burn) {
      events.push({
        type: "GravefireCast",
        monster: monster.id,
        landing: { ...at },
      });
    }
    return;
  }
  world.projectiles.push({
    ...flying,
    speed: ranged.projectileSpeed,
    rangeLeft: ranged.projectileRange,
  });
}

/** A damage range `share` of itself, each end at least 1. */
export function shareOfRange(
  [min, max]: [number, number],
  share: number,
): [number, number] {
  return [
    Math.max(1, Math.round(min * share)),
    Math.max(1, Math.round(max * share)),
  ];
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
    stepped.returnSpeed * walkPace(monster),
  );
  if (distance(monster.pos, monster.home) > 0) return;
  monster.state = "idle";
  monster.life = monsterMaxLife(monster);
  monster.curse = null;
  monster.chill = null;
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
function targetBody(world: World, target: MonsterTarget): object | null {
  if (target === "hero") return world.hero;
  return world.minions.find((minion) => minion.id === target) ?? null;
}
