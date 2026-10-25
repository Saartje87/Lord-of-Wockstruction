import { areaTuning } from "../tuning/areas";
import { heroTuning } from "../tuning/hero";
import { type MonsterType, monsterTuning } from "../tuning/monsters";
import { type Area, exitAt, isWalkable, loadArea, type Spawn } from "./area";
import { noticeHit, stepMonsters, wanderPause } from "./monsters";
import { findPath } from "./path";
import { createRng, type Rng, random, randomInt } from "./random";
import { msToSteps, perStep } from "./units";
import { validateAreas } from "./validate";
import { angleBetween, distance, type Vec } from "./vec";

const WALK_PER_STEP = perStep(heroTuning.walkSpeed);
/** How many steps a swing takes. */
export const SWING_STEPS = msToSteps(heroTuning.swingMs);
/** The step of a swing on which its hit lands. */
export const HIT_STEP = msToSteps(heroTuning.swingMs * heroTuning.hitAt);
const HITSTOP_STEPS = msToSteps(heroTuning.hitstopMs);
/** How many steps the Hero flinches for. */
export const HERO_FLINCH_STEPS = msToSteps(heroTuning.flinchMs);
const ARC = (heroTuning.arcDegrees * Math.PI) / 180;
/** How many steps dealing or taking damage keeps the Hero In Combat. */
const COMBAT_STEPS = msToSteps(heroTuning.combatMs);
/** Life the Hero regains per step outside In Combat. */
const REGEN_PER_STEP = perStep(heroTuning.regenPerSecond);
/** How many steps walking through an Exit takes. */
export const AREA_CHANGE_STEPS = msToSteps(areaTuning.changeMs);
/** The step of an Area change on which the Areas swap. */
const ARRIVE_STEP = Math.floor(AREA_CHANGE_STEPS / 2);
/** How many steps each Monster type flinches for. */
export const FLINCH_STEPS = Object.fromEntries(
  Object.entries(monsterTuning).map(([type, tuning]) => [
    type,
    msToSteps(tuning.flinchMs),
  ]),
) as Record<MonsterType, number>;

export type Hero = {
  life: number;
  pos: Vec;
  /** Where the Hero was one step ago, for the renderer to interpolate from. */
  prevPos: Vec;
  /** Waypoints still to walk through, in order; empty when standing. */
  path: Vec[];
  /**
   * Which way the Hero faces, in radians in tile space: `atan2(dy, dx)` of
   * the direction last walked or swung.
   */
  facing: number;
  /** The Monster the Hero is walking into reach of, to swing at. */
  attacking: MonsterId | null;
  swing: Swing | null;
  /** Steps of flinching left; 0 when not flinching. */
  flinch: number;
  /**
   * Steps left in which damage dealt or taken keeps the Hero In Combat,
   * counting through hitstop and Area changes; 0 once it no longer does.
   */
  combat: number;
  /**
   * The order given during a swing or a flinch, run when it ends; the newest
   * wins.
   */
  buffered: Order | null;
};

export type Swing = {
  /** Steps since the swing started, not counting hitstop. */
  elapsed: number;
  /** Whether its hit has landed yet. */
  landed: boolean;
  /** The Monster an `Attack` swings at, or null for a `SwingAt` arc. */
  monster: MonsterId | null;
};

export type MonsterId = number;

export type Monster = {
  /** Unique within the World and never reused. */
  id: MonsterId;
  type: MonsterType;
  pos: Vec;
  prevPos: Vec;
  life: number;
  /** Steps of flinching left; 0 when not flinching. */
  flinch: number;
  state: MonsterState;
  /**
   * Which way it faces, in radians in tile space: the direction it last
   * walked, or the Hero's as it started winding up.
   */
  facing: number;
  /**
   * While winding up, steps into the wind-up; while recovering, steps left
   * rooted.
   */
  attack: number;
  /** Steps left before it can wind up again. */
  cooldown: number;
  /** Where it was placed: it strolls around here and walks back here. */
  home: Vec;
  /**
   * Waypoints around walls to where it is going, empty on a clear line; or,
   * while wandering, the one point it strolls to.
   */
  path: Vec[];
  /** Steps until it re-plans `path`. */
  replan: number;
  /** Steps left in which it can't notice the Hero, after getting home. */
  grace: number;
  /** While idle, steps left before it strolls again. */
  pause: number;
};

/**
 * `idle` and `wander` stroll around the spawn, `chase` goes after the Hero,
 * `windup` telegraphs an attack on them, `recover` stands rooted after it and
 * `return` walks home after giving up.
 */
export type MonsterState =
  | "idle"
  | "wander"
  | "chase"
  | "windup"
  | "recover"
  | "return";

/**
 * Walking through an Exit to Entry `entry` in Area `area`. The World stands
 * still and orders are ignored until it ends.
 */
export type AreaChange = {
  area: string;
  entry: string;
  /** Steps since the Hero walked into the Exit. */
  elapsed: number;
};

/** What remains of a dead Monster: inert, not clickable, not blocking. */
export type Corpse = { id: MonsterId; type: MonsterType; pos: Vec };

export type World = {
  seed: number;
  /** All randomness comes from here, so a seed and orders replay exactly. */
  rng: Rng;
  /** Steps taken since the World was created, hitstop included. */
  tick: number;
  /** Steps left in which the whole simulation stands still. */
  hitstop: number;
  /** Orders given during hitstop, applied once it ends. */
  heldOrders: Order[];
  areas: Record<string, Area>;
  /** The one active Area. */
  areaName: string;
  /** The Area change in progress, if any. */
  areaChange: AreaChange | null;
  hero: Hero;
  /** The living Monsters in the active Area. */
  monsters: Monster[];
  /** The Corpses in the active Area. */
  corpses: Corpse[];
  /** The id the next Monster gets. */
  nextMonsterId: MonsterId;
};

/** Input reaching the simulation. */
export type Order =
  | { type: "MoveTo"; target: Vec }
  /** Walk into reach of a Monster and swing at it. */
  | { type: "Attack"; monster: MonsterId }
  /** Swing in place towards a point, hitting every Monster in the arc. */
  | { type: "SwingAt"; target: Vec };

/** What happened during a step. */
export type SimEvent =
  | { type: "HitLanded"; attacker: "hero"; target: MonsterId; damage: number }
  | { type: "HeroHit"; damage: number }
  | { type: "MonsterDied"; id: MonsterId }
  /** The Hero arrived at Entry `entry` in Area `area`. */
  | { type: "AreaChanged"; area: string; entry: string };

const TOWN = "town";

/**
 * Builds a World from raw `.tmj` content keyed by Area name, with the Hero in
 * Town at its `start` Entry. `tilesets` holds the raw `.tsj` content of the
 * tilesets the Areas keep in their own files, keyed by file name. Throws,
 * naming the Area, on content that doesn't fit together (see
 * `validateAreas`).
 */
export function createWorld(options: {
  areas: Record<string, unknown>;
  tilesets?: Record<string, unknown>;
  seed: number;
}): World {
  const areas: Record<string, Area> = {};
  for (const [name, content] of Object.entries(options.areas)) {
    areas[name] = loadArea(name, content, options.tilesets);
  }

  validateAreas(areas);
  const town = areas[TOWN];
  if (!town) throw new Error(`No Area named "${TOWN}"`);
  const start = town.entries.start;

  const world: World = {
    seed: options.seed,
    rng: createRng(options.seed),
    tick: 0,
    hitstop: 0,
    heldOrders: [],
    areas,
    areaName: TOWN,
    areaChange: null,
    hero: {
      life: heroTuning.life,
      pos: { ...start },
      prevPos: { ...start },
      path: [],
      // Down the screen, along +x and +y.
      facing: Math.PI / 4,
      attacking: null,
      swing: null,
      flinch: 0,
      combat: 0,
      buffered: null,
    },
    monsters: [],
    corpses: [],
    nextMonsterId: 1,
  };
  for (const spawn of town.spawns) placePack(world, town, spawn);
  return world;
}

/** The Monster states in which a Monster is going after the Hero. */
const AFTER_HERO: readonly MonsterState[] = ["chase", "windup", "recover"];

/**
 * Whether the Hero is In Combat: they dealt or took damage in the last
 * `combatMs`, or a Monster is going after them.
 */
export function isInCombat(world: World): boolean {
  return (
    world.hero.combat > 0 ||
    world.monsters.some((monster) => AFTER_HERO.includes(monster.state))
  );
}

/** Whether the Hero is regaining Life: out of combat and below full. */
export function isRegenerating(world: World): boolean {
  return !isInCombat(world) && world.hero.life < heroTuning.life;
}

/**
 * How dark the screen is for an Area change, 0..1: fading to black until the
 * Areas swap, then back.
 */
export function areaFade(world: World): number {
  const change = world.areaChange;
  if (!change) return 0;
  return 1 - Math.abs(change.elapsed - ARRIVE_STEP) / ARRIVE_STEP;
}

/**
 * Starts the Area change to an Exit's target, stopping the Hero and ending
 * any hitstop.
 */
function startAreaChange(world: World, area: string, entry: string) {
  const { hero } = world;
  world.areaChange = { area, entry, elapsed: 0 };
  // A hit landed on this step stops for the fade instead.
  world.hitstop = 0;
  hero.path = [];
  hero.attacking = null;
  hero.swing = null;
  hero.flinch = 0;
  hero.buffered = null;
}

/** Advances an Area change, swapping the Areas halfway through. */
function stepAreaChange(world: World, change: AreaChange, events: SimEvent[]) {
  change.elapsed += 1;
  if (change.elapsed === ARRIVE_STEP) arrive(world, change, events);
  if (change.elapsed >= AREA_CHANGE_STEPS) world.areaChange = null;
}

/**
 * Makes the target Area the active one, fresh from its definition: its
 * Monsters back at their spawns and no Corpses. The Hero carries over to the
 * target Entry, facing away from the Area's nearest edge, with their Life
 * restored to full on arriving in Town.
 */
function arrive(world: World, change: AreaChange, events: SimEvent[]) {
  const area = world.areas[change.area];
  const at = area.entries[change.entry];
  const { hero } = world;
  hero.pos = { ...at };
  hero.prevPos = { ...at };
  hero.facing = awayFromEdge(area, at);
  if (area.name === TOWN) {
    hero.life = heroTuning.life;
    hero.combat = 0;
  }
  world.areaName = area.name;
  world.monsters = [];
  world.corpses = [];
  world.heldOrders = [];
  for (const spawn of area.spawns) placePack(world, area, spawn);
  events.push({ type: "AreaChanged", area: area.name, entry: change.entry });
}

/** The facing straight away from the Area edge nearest a point. */
function awayFromEdge(area: Area, point: Vec): number {
  const edges = [
    { gap: point.x, facing: 0 },
    { gap: area.width - point.x, facing: Math.PI },
    { gap: point.y, facing: Math.PI / 2 },
    { gap: area.height - point.y, facing: -Math.PI / 2 },
  ];
  return edges.reduce((a, b) => (b.gap < a.gap ? b : a)).facing;
}

/** How far apart a pack's Monsters stand, centre to centre (tiles). */
const PACK_GAP = 0.8;

/**
 * Places a spawn's Monsters: the first on the spawn point and the rest in a
 * ring around it, or on the spawn point where the ring isn't walkable.
 */
function placePack(world: World, area: Area, spawn: Spawn) {
  const ring = spawn.count - 1;
  const radius = Math.max(PACK_GAP, (PACK_GAP * ring) / (2 * Math.PI));
  for (let i = 0; i < spawn.count; i++) {
    const angle = (2 * Math.PI * (i - 1)) / ring;
    const around = {
      x: spawn.pos.x + radius * Math.cos(angle),
      y: spawn.pos.y + radius * Math.sin(angle),
    };
    const pos = i > 0 && isWalkable(area, around) ? around : { ...spawn.pos };
    world.monsters.push({
      id: world.nextMonsterId++,
      type: spawn.monster,
      pos,
      prevPos: { ...pos },
      life: monsterTuning[spawn.monster].life,
      flinch: 0,
      state: "idle",
      // Down the screen, as the Hero starts.
      facing: Math.PI / 4,
      attack: 0,
      cooldown: 0,
      home: { ...pos },
      path: [],
      replan: 0,
      grace: 0,
      // So a pack doesn't set off strolling in step.
      pause: wanderPause(world, spawn.monster),
    });
  }
}

/**
 * Advances the World by one fixed 1/60 s step. During hitstop nothing
 * happens at all: orders wait until it ends. During an Area change nothing
 * happens but the change, and orders are ignored.
 */
export function step(world: World, orders: readonly Order[]): SimEvent[] {
  const { hero } = world;
  const events: SimEvent[] = [];
  hero.prevPos = { ...hero.pos };
  for (const monster of world.monsters) monster.prevPos = { ...monster.pos };
  if (hero.combat > 0) hero.combat -= 1;

  if (world.areaChange) {
    stepAreaChange(world, world.areaChange, events);
    world.tick += 1;
    return events;
  }

  if (world.hitstop > 0) {
    world.hitstop -= 1;
    world.heldOrders.push(...orders);
    world.tick += 1;
    return events;
  }

  for (const monster of world.monsters) {
    if (monster.flinch > 0) monster.flinch -= 1;
  }
  if (hero.swing) advanceSwing(world, hero.swing, events);
  if (hero.flinch > 0) stepFlinch(world);
  for (const order of [...world.heldOrders, ...orders]) give(world, order);
  world.heldOrders = [];
  // Swing from where the Hero stands if already in reach, or once walked
  // into it.
  approach(world);
  walk(hero);
  const area = world.areas[world.areaName];
  const exit = exitAt(area, hero.pos);
  if (exit && exit !== exitAt(area, hero.prevPos)) {
    startAreaChange(world, exit.area, exit.entry);
    world.tick += 1;
    return events;
  }
  approach(world);
  for (const monster of stepMonsters(world)) hitHero(world, monster, events);
  if (isRegenerating(world)) {
    hero.life = Math.min(heroTuning.life, hero.life + REGEN_PER_STEP);
  }

  world.tick += 1;
  return events;
}

/** Applies an order, or buffers it during a flinch or a committed swing. */
function give(world: World, order: Order) {
  const { hero } = world;
  if (hero.flinch > 0) {
    hero.buffered = order;
    return;
  }
  if (hero.swing) {
    // A move may walk out of a swing's follow-through, not its wind-up.
    if (order.type !== "MoveTo" || !hero.swing.landed) {
      hero.buffered = order;
      return;
    }
    hero.swing = null;
    hero.buffered = null;
  }

  const area = world.areas[world.areaName];
  switch (order.type) {
    case "MoveTo":
      hero.attacking = null;
      hero.path = findPath(area, hero.pos, order.target, heroTuning.radius);
      break;
    case "Attack": {
      const monster = monsterById(world, order.monster);
      if (!monster) return;
      hero.attacking = monster.id;
      hero.path = findPath(area, hero.pos, monster.pos, heroTuning.radius);
      break;
    }
    case "SwingAt":
      startSwing(hero, null, order.target);
      break;
  }
}

/** Swings at the Monster the Hero walks to once it is in reach. */
function approach(world: World) {
  const { hero } = world;
  if (hero.attacking === null || hero.swing) return;
  const monster = monsterById(world, hero.attacking);
  if (!monster) {
    hero.attacking = null;
    hero.path = [];
  } else if (distance(hero.pos, monster.pos) <= heroTuning.reach) {
    startSwing(hero, monster.id, monster.pos);
  } else if (hero.path.length === 0) {
    // Walked as near as it can get, still out of reach.
    hero.attacking = null;
  }
}

function startSwing(hero: Hero, monster: MonsterId | null, toward: Vec) {
  const dx = toward.x - hero.pos.x;
  const dy = toward.y - hero.pos.y;
  if (dx !== 0 || dy !== 0) hero.facing = Math.atan2(dy, dx);
  hero.swing = { elapsed: 0, landed: false, monster };
  hero.attacking = null;
  hero.path = [];
}

function advanceSwing(world: World, swing: Swing, events: SimEvent[]) {
  const { hero } = world;
  swing.elapsed += 1;
  if (swing.elapsed === HIT_STEP) land(world, swing, events);
  if (swing.elapsed < SWING_STEPS) return;

  hero.swing = null;
  giveBuffered(world);
}

/** Counts down the Hero's flinch, running the buffered order once it ends. */
function stepFlinch(world: World) {
  const { hero } = world;
  hero.flinch -= 1;
  if (hero.flinch === 0) giveBuffered(world);
}

/** Gives the order buffered during a swing or a flinch, if any. */
function giveBuffered(world: World) {
  const { hero } = world;
  const buffered = hero.buffered;
  hero.buffered = null;
  if (buffered) give(world, buffered);
}

/** Lands a swing's hit on its target, or on every Monster in its arc. */
function land(world: World, swing: Swing, events: SimEvent[]) {
  const { hero } = world;
  swing.landed = true;
  const victims = world.monsters.filter((monster) => {
    const gap = distance(hero.pos, monster.pos);
    if (swing.monster !== null) {
      return (
        monster.id === swing.monster &&
        gap <= heroTuning.reach + heroTuning.reachGrace
      );
    }
    if (gap > heroTuning.reach) return false;
    if (gap === 0) return true;
    const angle = Math.atan2(
      monster.pos.y - hero.pos.y,
      monster.pos.x - hero.pos.x,
    );
    return angleBetween(angle, hero.facing) <= ARC;
  });

  if (victims.length > 0) world.hitstop = HITSTOP_STEPS;
  for (const monster of victims) hit(world, monster, events);
}

function hit(world: World, monster: Monster, events: SimEvent[]) {
  const damage = randomInt(world.rng, heroTuning.damage);
  monster.life = Math.max(0, monster.life - damage);
  world.hero.combat = COMBAT_STEPS;
  events.push({
    type: "HitLanded",
    attacker: "hero",
    target: monster.id,
    damage,
  });

  if (monster.life === 0) {
    world.monsters = world.monsters.filter((m) => m !== monster);
    world.corpses.push({
      id: monster.id,
      type: monster.type,
      pos: monster.pos,
    });
    events.push({ type: "MonsterDied", id: monster.id });
    return;
  }
  noticeHit(world, monster);
  if (random(world.rng) < monsterTuning[monster.type].flinchChance) {
    monster.flinch = FLINCH_STEPS[monster.type];
  }
}

/** Lands a Monster's attack on the Hero. */
function hitHero(world: World, monster: Monster, events: SimEvent[]) {
  const { hero } = world;
  const damage = randomInt(world.rng, monsterTuning[monster.type].damage);
  hero.life = Math.max(0, hero.life - damage);
  hero.combat = COMBAT_STEPS;
  events.push({ type: "HeroHit", damage });

  // A swing's follow-through carries on.
  if (hero.swing?.landed) return;
  if (random(world.rng) >= heroTuning.flinchChance) return;
  hero.flinch = HERO_FLINCH_STEPS;
  hero.swing = null;
  hero.attacking = null;
  hero.path = [];
}

function monsterById(world: World, id: MonsterId): Monster | undefined {
  return world.monsters.find((monster) => monster.id === id);
}

/** Moves the Hero one step along its path, carrying over past waypoints. */
function walk(hero: Hero) {
  let budget = WALK_PER_STEP;
  while (budget > 0 && hero.path.length > 0) {
    const next = hero.path[0];
    const dx = next.x - hero.pos.x;
    const dy = next.y - hero.pos.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0) hero.facing = Math.atan2(dy, dx);
    if (distance <= budget) {
      hero.pos = { ...next };
      hero.path.shift();
      budget -= distance;
    } else {
      hero.pos = {
        x: hero.pos.x + (dx / distance) * budget,
        y: hero.pos.y + (dy / distance) * budget,
      };
      budget = 0;
    }
  }
}
