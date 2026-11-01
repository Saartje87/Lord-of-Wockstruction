import {
  type AnimationAction,
  AnimationMixer,
  Group,
  LoopRepeat,
  type Mesh,
  type MeshToonMaterial,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Vec } from "../sim/vec";
import { blendClips, scrubTime, turnTowards } from "./actorPose";
import type { MonsterLook } from "./monsterLook";
import {
  glowMaterials,
  type Inks,
  inksOf,
  LOOKS,
  materialsOf,
  outline,
  outlinesOf,
  toonShade,
} from "./toon";
import type { MonsterAnimation } from "./view";

/**
 * Seconds of looping-clip phase each Monster id adds, so a crowd of the same
 * kind does not move in lockstep.
 */
const PHASE_SECONDS_PER_ID = 0.37;
/** How fast a Monster turns to face a new way, per second (an easing rate). */
const TURN_RATE = 14;
/** How bright a fully flashed Monster glows. */
const FLASH_GLOW = 0.9;
/** The colour a hit Monster flashes. */
const FLASH_COLOUR = 0xffffff;
/** The colour and strength of a flared Monster's glow. */
const FLARE_COLOUR = 0xff5a14;
const FLARE_GLOW = 0.45;
/** How long a flared, Chilled Monster shows each of its glows in turn (s). */
const ALTERNATE_GLOW_SECONDS = 0.4;
/** The colour and strength of a Chilled Monster's glow. */
const CHILL_COLOUR = 0x5fc8ff;
const CHILL_GLOW = 0.5;
/** The outline's width, in tiles. */
const OUTLINE = 0.022;

/** The loaded models the Monsters are made of, by file name. */
export type MonsterModels = Record<string, GLTF>;

/** What an actor poses as: a Monster, a Corpse or a Minion. */
export type Posed = {
  id: number;
  /** Interpolated, in tile units. */
  pos: Vec;
  /** Radians in tile space; null keeps the way it last faced. */
  facing: number | null;
  animation: MonsterAnimation;
  /** How white it is washed, 0..1. */
  flash?: number;
  /** Whether it glows with a flare of fire; false when missing. */
  flared?: boolean;
  /** Whether it glows with frost, from a Frost Bolt; false when missing. */
  chilled?: boolean;
  /** Times the look's scale; 1 when missing. */
  scale?: number;
  /** Whether it is outlined as hovered or targeted. */
  highlighted: boolean;
};

/** A character's model, its clips, and what it is showing now. */
export type MonsterActor = {
  /** Stands at the Monster's position, facing its way. */
  root: Group;
  mixer: AnimationMixer;
  actions: Map<string, AnimationAction>;
  /** Its own materials, so it can flash alone. */
  materials: MeshToonMaterial[];
  /** The meshes of its outline, and the inks to draw them in. */
  hulls: Mesh[];
  inks: Inks;
  /** The KayKit clip that plays each of its animations. */
  clips: MonsterLook["clips"];
  highlighted: boolean;
  /** Radians the model is turned by now, eased towards its facing. */
  turn: number | null;
  /** Seconds posed so far: alternates the glow of a flared, Chilled Monster. */
  glowSeconds: number;
};

/** Makes an actor of a character looking like `look` from the loaded models. */
export function monsterActorOf(
  look: MonsterLook,
  models: MonsterModels,
): MonsterActor {
  const body = models[look.model];
  const model = clone(body.scene);
  for (const { slot, model: weaponFile } of look.weapons) {
    const hand = model.getObjectByName(slot);
    if (hand) hand.add(clone(models[weaponFile].scene));
  }
  toonShade(model, LOOKS[look.look ?? "character"]);
  outline(model, OUTLINE, look.scale);
  model.scale.setScalar(look.scale);
  const root = new Group();
  root.add(model);
  const mixer = new AnimationMixer(model);
  const actions = new Map<string, AnimationAction>();
  for (const clip of body.animations) {
    const action = mixer.clipAction(clip);
    // The View decides the time of every clip, so none runs on its own.
    action.timeScale = 0;
    action.setLoop(LoopRepeat, Infinity);
    action.weight = 0;
    action.play();
    actions.set(clip.name, action);
  }
  return {
    root,
    mixer,
    actions,
    materials: materialsOf(model),
    hulls: outlinesOf(model),
    inks: inksOf(OUTLINE, look.scale),
    clips: look.clips,
    highlighted: false,
    turn: null,
    glowSeconds: 0,
  };
}

/**
 * Poses the actor as `monster` says, `dt` seconds after the last pose: moves
 * it, turns it towards its facing, flashes it, and blends to the clip,
 * scrubbed to the time.
 */
export function poseMonster(actor: MonsterActor, monster: Posed, dt: number) {
  const first = actor.turn === null;
  actor.root.position.set(monster.pos.x, 0, monster.pos.y);
  // A Corpse keeps the way it last faced.
  if (monster.facing !== null) {
    actor.turn = turnTowards(actor.turn, monster.facing, dt, TURN_RATE);
  }
  actor.root.rotation.y = actor.turn ?? 0;
  actor.root.scale.setScalar(monster.scale ?? 1);
  actor.glowSeconds += dt;
  // A hit's white flash shows over the flare and the chill, which take turns
  // when a Monster has both.
  const flash = (monster.flash ?? 0) * FLASH_GLOW;
  const chillTurn =
    !monster.flared ||
    Math.floor(actor.glowSeconds / ALTERNATE_GLOW_SECONDS) % 2 === 1;
  if (flash > 0) {
    glowMaterials(actor.materials, FLASH_COLOUR, flash);
  } else if (monster.chilled && chillTurn) {
    glowMaterials(actor.materials, CHILL_COLOUR, CHILL_GLOW);
  } else if (monster.flared) {
    glowMaterials(actor.materials, FLARE_COLOUR, FLARE_GLOW);
  } else {
    glowMaterials(actor.materials, FLASH_COLOUR, 0);
  }
  if (monster.highlighted !== actor.highlighted) {
    actor.highlighted = monster.highlighted;
    const ink = monster.highlighted ? actor.inks.highlight : actor.inks.ink;
    for (const hull of actor.hulls) hull.material = ink;
  }

  const name = actor.clips[monster.animation.clip] ?? actor.clips.idle;
  blendClips(actor.actions, name, dt, first);
  const action = actor.actions.get(name);
  if (action) {
    action.time = scrubTime(
      monster.animation,
      action.getClip().duration,
      monster.id * PHASE_SECONDS_PER_ID,
    );
  }
  actor.mixer.update(0);
}
