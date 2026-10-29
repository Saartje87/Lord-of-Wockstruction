import { type Area, type Placed, TOWN } from "../sim/area";
import { STEP_MS } from "../sim/units";
import type { Vec } from "../sim/vec";
import {
  CAST_STEPS,
  DEATH_STEPS,
  HERO_FLINCH_STEPS,
  HIT_STEP,
  OPENING_STEPS,
  SWING_STEPS,
  type World,
} from "../sim/world";
import { inputTuning } from "../tuning/input";
import { ATTACK_CONTACT, type HeroClip } from "./clips";
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

/** The click marker on the floor, `progress` of the way through its life. */
export type ClickMarkerView = { at: Vec; progress: number };

/** What the pointer shows in the World. */
export type PointerState = {
  /** The floor tile to outline, if the pointer is over one. */
  hoverTile: Vec | null;
  /** The last click on the floor and how long ago it was. */
  click: { at: Vec; ageMs: number } | null;
};

/** Everything the 3D World shows, as plain data. */
export type WorldView = {
  hero: HeroView;
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
