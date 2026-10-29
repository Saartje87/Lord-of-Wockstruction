import type { CharacterId } from "../render/hover";
import { type Area, type Placed, TOWN } from "../sim/area";
import type { ItemId } from "../sim/inventory";
import { minionRecoveryProgress, minionWindUpProgress } from "../sim/minions";
import { recoveryProgress, windUpProgress } from "../sim/monsters";
import { STEP_MS } from "../sim/units";
import type { Vec } from "../sim/vec";
import {
  CAST_STEPS,
  DEATH_STEPS,
  FLINCH_STEPS,
  HERO_FLINCH_STEPS,
  HIT_STEP,
  type Minion,
  type MinionId,
  type Monster,
  type MonsterId,
  OPENING_STEPS,
  SWING_STEPS,
  type World,
} from "../sim/world";
import { inputTuning } from "../tuning/input";
import type { ItemType } from "../tuning/items";
import type { MinionType } from "../tuning/minions";
import type { MonsterType } from "../tuning/monsters";
import type { ProjectileKind } from "../tuning/projectiles";
import { ATTACK_CONTACT, type HeroClip } from "./clips";
import { MINION_LOOKS } from "./minionLook";
import {
  MONSTER_DEATH_SECONDS,
  MONSTER_LOOKS,
  type MonsterClip,
} from "./monsterLook";
import { type Torch, torchesOf } from "./torches";

/**
 * What the Hero is doing, as the clip to show and how far into it: idle and
 * run loop, and `seconds` is the time the World has been running; the others
 * play once, scrubbed to `progress` (0..1) of their clip.
 */
export type HeroAnimation =
  | { clip: "idle" | "run"; seconds: number }
  | { clip: Exclude<HeroClip, "idle" | "run">; progress: number };

/** The Hero as the 3D World shows them. */
export type HeroView = {
  /** Interpolated, in tile units. */
  pos: Vec;
  /** Radians in tile space, as the World's `facing`. */
  facing: number;
  animation: HeroAnimation;
};

/** What a Monster is doing, as `HeroAnimation` says for the Hero. */
export type MonsterAnimation =
  | { clip: "idle" | "walk" | "run"; seconds: number }
  | { clip: Exclude<MonsterClip, "idle" | "walk" | "run">; progress: number };

/** A Monster, or the Corpse it left, as the 3D World shows it. */
export type MonsterView = {
  id: MonsterId;
  type: MonsterType;
  /** Interpolated, in tile units. */
  pos: Vec;
  /** Radians in tile space; null for a Corpse, which lies as it last stood. */
  facing: number | null;
  animation: MonsterAnimation;
  /** How white a hit Monster is washed, 0..1. */
  flash: number;
  corpse: boolean;
  /** Whether it is outlined as hovered or targeted. */
  highlighted: boolean;
};

/** One of the Hero's Minions as the 3D World shows it. */
export type MinionView = {
  id: MinionId;
  type: MinionType;
  /** Interpolated, in tile units. */
  pos: Vec;
  /** Radians in tile space. */
  facing: number;
  animation: MonsterAnimation;
  /** Whether it is outlined as hovered. */
  highlighted: boolean;
};

/**
 * What the 3D World shows that the World doesn't hold, because it lasts
 * milliseconds rather than steps: kept by the renderer from the events.
 */
export type Effects = {
  /** The flash strength (0..1) of each Monster just hit. */
  flashes: ReadonlyMap<MonsterId, number>;
  /** How long ago (ms) each Monster just killed died; others lie still. */
  deadForMs: ReadonlyMap<MonsterId, number>;
};

/** A Projectile in flight as the 3D World shows it. */
export type ProjectileView = {
  kind: ProjectileKind;
  /** Interpolated, in tile units. */
  pos: Vec;
  /** The way it flies, radians in tile space. */
  facing: number;
};

/** A Ground Item lying on the floor as the 3D World shows it. */
export type GroundItemView = { id: ItemId; type: ItemType; pos: Vec };

/** The click marker on the floor, `progress` of the way through its life. */
export type ClickMarkerView = { at: Vec; progress: number };

/** What the pointer shows in the World. */
export type PointerState = {
  /** The floor tile to outline, if the pointer is over one. */
  hoverTile: Vec | null;
  /** The last click on the floor and how long ago it was. */
  click: { at: Vec; ageMs: number } | null;
  /** The Monster or Minion to outline: the hovered one, else the Target. */
  highlight: CharacterId | null;
};

/** Everything the 3D World shows, as plain data. */
export type WorldView = {
  hero: HeroView;
  /** The living Monsters, then the Corpses. */
  monsters: MonsterView[];
  /** The Hero's living Minions. */
  minions: MinionView[];
  projectiles: ProjectileView[];
  groundItems: GroundItemView[];
  clickMarker: ClickMarkerView | null;
  hoverTile: Vec | null;
  /**
   * The Area's Walls drawn lowered to stubs, so they don't hide the Hero:
   * indices into its `walls`, ascending.
   */
  loweredWalls: number[];
  /**
   * The torches on the Area's Walls. A torch is lit unless its Wall is
   * lowered; the scene gives its light to the lit ones nearest the Hero.
   */
  torches: (Torch & { lit: boolean })[];
  /** Whether the Area is a Combat Area, which has embers and a vignette. */
  combat: boolean;
};

/** An Area's torches, worked out once. */
const torchCache = new WeakMap<Area, Torch[]>();

function torchesIn(area: Area): Torch[] {
  let torches = torchCache.get(area);
  if (!torches) {
    torches = torchesOf(area);
    torchCache.set(area, torches);
  }
  return torches;
}

/**
 * The Walls between the camera and the Hero: those a few tiles on the
 * camera's side of the Hero's tile, in a band across the screen. The camera
 * looks from tile +x +y, so "nearer the camera" is a greater x + y.
 */
function loweredWallsOf(walls: Placed[], hero: Vec): number[] {
  const hx = Math.floor(hero.x) + 0.5;
  const hy = Math.floor(hero.y) + 0.5;
  const lowered: number[] = [];
  walls.forEach((wall, i) => {
    const dx = wall.x + 0.5 - hx;
    const dy = wall.y + 0.5 - hy;
    const nearer = dx + dy;
    if (nearer > 0.5 && nearer < 7 && Math.abs(dx - dy) < 5) lowered.push(i);
  });
  return lowered;
}

/**
 * What the 3D World shows of `world`, `alpha` (0..1) of the way from the
 * previous step to the current one, and of the pointer. A pure function of
 * them: the three.js layer applies it to the scene and holds no game logic.
 */
export function worldViewOf(
  world: World,
  alpha: number,
  pointer: PointerState,
  effects: Effects = { flashes: new Map(), deadForMs: new Map() },
): WorldView {
  const { hero } = world;
  const pos = {
    x: hero.prevPos.x + (hero.pos.x - hero.prevPos.x) * alpha,
    y: hero.prevPos.y + (hero.pos.y - hero.prevPos.y) * alpha,
  };
  const area = world.areas[world.areaName];
  const loweredWalls = loweredWallsOf(area.walls, pos);
  return {
    hero: {
      pos,
      facing: hero.facing,
      animation: heroAnimationOf(world),
    },
    monsters: [
      ...world.monsters.map((monster) =>
        monsterViewOf(world, monster, alpha, effects, pointer.highlight),
      ),
      ...world.corpses.map(
        (corpse): MonsterView => ({
          id: corpse.id,
          type: corpse.type,
          pos: corpse.pos,
          facing: null,
          animation: corpseAnimationOf(effects.deadForMs.get(corpse.id)),
          flash: 0,
          corpse: true,
          highlighted: false,
        }),
      ),
    ],
    minions: world.minions.map((minion) =>
      minionViewOf(world, minion, alpha, pointer.highlight),
    ),
    projectiles: world.projectiles.map((projectile) => ({
      kind: projectile.kind,
      pos: {
        x:
          projectile.prevPos.x +
          (projectile.pos.x - projectile.prevPos.x) * alpha,
        y:
          projectile.prevPos.y +
          (projectile.pos.y - projectile.prevPos.y) * alpha,
      },
      facing: Math.atan2(projectile.direction.y, projectile.direction.x),
    })),
    groundItems: world.groundItems.map(({ item, pos }) => ({
      id: item.id,
      type: item.type,
      pos: { ...pos },
    })),
    clickMarker: clickMarkerOf(pointer.click),
    hoverTile: pointer.hoverTile,
    loweredWalls,
    torches: torchesIn(area).map((torch) => ({
      ...torch,
      lit: !loweredWalls.includes(torch.wall),
    })),
    combat: world.areaName !== TOWN,
  };
}

/** A Corpse's fall: `ms` into it if it just died, else it lies still. */
function corpseAnimationOf(ms: number | undefined): MonsterAnimation {
  const progress =
    ms === undefined ? 1 : Math.min(1, ms / 1000 / MONSTER_DEATH_SECONDS);
  return { clip: "death", progress };
}

/** A living Monster as shown: its animation chosen by its state, as in 2D. */
function monsterViewOf(
  world: World,
  monster: Monster,
  alpha: number,
  effects: Effects,
  highlight: CharacterId | null,
): MonsterView {
  const { contact } = MONSTER_LOOKS[monster.type];
  const moving =
    monster.pos.x !== monster.prevPos.x || monster.pos.y !== monster.prevPos.y;
  let animation: MonsterAnimation;
  if (monster.state === "windup") {
    // A flinch doesn't stop a wind-up, so it shows over one.
    animation = {
      clip: "attack",
      progress: windUpProgress(monster) * contact,
    };
  } else if (monster.flinch > 0) {
    animation = {
      clip: "flinch",
      progress:
        (FLINCH_STEPS[monster.type] - monster.flinch) /
        FLINCH_STEPS[monster.type],
    };
  } else if (monster.state === "recover") {
    animation = {
      clip: "attack",
      progress: contact + recoveryProgress(monster) * (1 - contact),
    };
  } else {
    const seconds = (world.tick * STEP_MS) / 1000;
    const clip = !moving ? "idle" : monster.state === "chase" ? "run" : "walk";
    animation = { clip, seconds };
  }
  return {
    id: monster.id,
    type: monster.type,
    pos: {
      x: monster.prevPos.x + (monster.pos.x - monster.prevPos.x) * alpha,
      y: monster.prevPos.y + (monster.pos.y - monster.prevPos.y) * alpha,
    },
    facing: monster.facing,
    animation,
    flash: effects.flashes.get(monster.id) ?? 0,
    corpse: false,
    highlighted: highlight === monster.id,
  };
}

/** A Minion as shown: its animation chosen by its state, as a Monster's. */
function minionViewOf(
  world: World,
  minion: Minion,
  alpha: number,
  highlight: CharacterId | null,
): MinionView {
  const { contact } = MINION_LOOKS[minion.type];
  const moving =
    minion.pos.x !== minion.prevPos.x || minion.pos.y !== minion.prevPos.y;
  let animation: MonsterAnimation;
  if (minion.state === "windup") {
    animation = {
      clip: "attack",
      progress: minionWindUpProgress(minion) * contact,
    };
  } else if (minion.state === "recover") {
    animation = {
      clip: "attack",
      progress: contact + minionRecoveryProgress(minion) * (1 - contact),
    };
  } else {
    const seconds = (world.tick * STEP_MS) / 1000;
    const clip = !moving ? "idle" : minion.state === "chase" ? "run" : "walk";
    animation = { clip, seconds };
  }
  return {
    id: minion.id,
    type: minion.type,
    pos: {
      x: minion.prevPos.x + (minion.pos.x - minion.prevPos.x) * alpha,
      y: minion.prevPos.y + (minion.pos.y - minion.prevPos.y) * alpha,
    },
    facing: minion.facing,
    animation,
    highlighted:
      typeof highlight === "object" &&
      highlight !== null &&
      highlight.minion === minion.id,
  };
}

/** The Hero's animation, the World's state deciding which, as in 2D. */
function heroAnimationOf(world: World): HeroAnimation {
  const { hero, death } = world;
  if (death) {
    return {
      clip: "death",
      progress: Math.min(1, death.elapsed / DEATH_STEPS),
    };
  }
  if (hero.swing) {
    return { clip: "swing", progress: swingProgress(hero.swing.elapsed) };
  }
  if (hero.cast) {
    return {
      clip: "cast",
      progress: hero.cast.elapsed / CAST_STEPS[hero.cast.skill],
    };
  }
  if (hero.opening) {
    return { clip: "cast", progress: hero.opening.elapsed / OPENING_STEPS };
  }
  if (hero.flinch > 0) {
    return {
      clip: "flinch",
      progress: (HERO_FLINCH_STEPS - hero.flinch) / HERO_FLINCH_STEPS,
    };
  }
  const moving = hero.pos.x !== hero.prevPos.x || hero.pos.y !== hero.prevPos.y;
  return {
    clip: moving ? "run" : "idle",
    seconds: (world.tick * STEP_MS) / 1000,
  };
}

/**
 * How far through the attack clip a swing `elapsed` steps in is: the clip's
 * contact frame falls on the step the hit lands, the rest of the clip on the
 * steps after it.
 */
function swingProgress(elapsed: number): number {
  if (elapsed <= HIT_STEP) return (elapsed / HIT_STEP) * ATTACK_CONTACT;
  return (
    ATTACK_CONTACT +
    ((elapsed - HIT_STEP) / (SWING_STEPS - HIT_STEP)) * (1 - ATTACK_CONTACT)
  );
}

/** The click marker `click` makes, fading out over the tuned time. */
function clickMarkerOf(click: PointerState["click"]): ClickMarkerView | null {
  if (!click) return null;
  const progress = click.ageMs / inputTuning.clickMarkerMs;
  return progress < 1 ? { at: click.at, progress } : null;
}
