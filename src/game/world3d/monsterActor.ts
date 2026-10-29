import {
  type AnimationAction,
  AnimationMixer,
  Group,
  LoopRepeat,
  type Mesh,
  type MeshToonMaterial,
  type Object3D,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Vec } from "../sim/vec";
import type { MonsterLook } from "./monsterLook";
import {
  type Inks,
  inksOf,
  LOOKS,
  outline,
  outlinesOf,
  toonShade,
} from "./toon";
import type { MonsterAnimation } from "./view";

/** How long one clip takes to give way to the next, seconds. */
const BLEND_SECONDS = 0.12;
/** How fast a Monster turns to face a new way, per second (an easing rate). */
const TURN_RATE = 14;
/** How bright a fully flashed Monster glows. */
const FLASH_GLOW = 0.9;
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
  };
}

/** The toon materials of every mesh under `model`, except outlines'. */
function materialsOf(model: Object3D): MeshToonMaterial[] {
  const materials: MeshToonMaterial[] = [];
  model.traverse((node) => {
    const mesh = node as Mesh;
    if (mesh.isMesh && !mesh.userData.isOutline) {
      materials.push(mesh.material as MeshToonMaterial);
    }
  });
  return materials;
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
    // KayKit's models look down +z; facing is atan2 in tile space (x, z).
    const target = Math.PI / 2 - monster.facing;
    if (first || actor.turn === null) {
      actor.turn = target;
    } else {
      const gap = Math.atan2(
        Math.sin(target - actor.turn),
        Math.cos(target - actor.turn),
      );
      actor.turn += gap * Math.min(1, dt * TURN_RATE);
    }
  }
  actor.root.rotation.y = actor.turn ?? 0;
  for (const material of actor.materials) {
    material.emissive.setScalar((monster.flash ?? 0) * FLASH_GLOW);
  }
  if (monster.highlighted !== actor.highlighted) {
    actor.highlighted = monster.highlighted;
    const ink = monster.highlighted ? actor.inks.highlight : actor.inks.ink;
    for (const hull of actor.hulls) hull.material = ink;
  }

  const name = actor.clips[monster.animation.clip];
  // The first pose has nothing to blend from.
  const blend = first ? 1 : Math.min(1, dt / BLEND_SECONDS);
  for (const [clipName, action] of actor.actions) {
    const goal = clipName === name ? 1 : 0;
    action.weight += Math.sign(goal - action.weight) * blend;
    action.weight = Math.min(1, Math.max(0, action.weight));
    if (clipName !== name) continue;
    const duration = action.getClip().duration;
    // Just short of the end, where a repeating clip would wrap round.
    const last = duration - 1e-3;
    action.time =
      "progress" in monster.animation
        ? Math.min(last, monster.animation.progress * duration)
        : (monster.animation.seconds + monster.id * 0.37) % duration;
  }
  actor.mixer.update(0);
}
