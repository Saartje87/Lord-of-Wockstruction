import { type AnimationAction, AnimationMixer, Group, LoopRepeat } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { blendClips, scrubTime, turnTowards } from "./actorPose";
import { HERO_CLIPS } from "./clips";
import { LOOKS, outline, toonShade } from "./toon";
import type { HeroView } from "./view";

/** The Knight is drawn a little larger than a tile's worth of model units. */
const HERO_SCALE = 0.36;
/** How fast the Hero turns to face a new way, per second (an easing rate). */
const TURN_RATE = 18;

/** The Hero's model, its clips, and what it is showing now. */
export type HeroActor = {
  /** Stands at the Hero's position, facing their way. */
  root: Group;
  mixer: AnimationMixer;
  actions: Map<string, AnimationAction>;
  /** Radians the model is turned by now, eased towards the Hero's facing. */
  turn: number | null;
};

/** Makes an actor of the loaded Knight. */
export function heroActorOf(knight: GLTF): HeroActor {
  const model = clone(knight.scene);
  toonShade(model, LOOKS.character);
  outline(model, 0.024, HERO_SCALE);
  model.scale.setScalar(HERO_SCALE);
  const root = new Group();
  root.add(model);
  const mixer = new AnimationMixer(model);
  const actions = new Map<string, AnimationAction>();
  for (const clip of knight.animations) {
    const action = mixer.clipAction(clip);
    // The View decides the time of every clip, so none runs on its own.
    action.timeScale = 0;
    action.setLoop(LoopRepeat, Infinity);
    action.weight = 0;
    action.play();
    actions.set(clip.name, action);
  }
  return { root, mixer, actions, turn: null };
}

/**
 * Poses the actor as `hero` says, `dt` seconds after the last pose: moves it,
 * turns it towards its facing, and blends to the clip, scrubbed to the time.
 */
export function poseHero(actor: HeroActor, hero: HeroView, dt: number) {
  const first = actor.turn === null;
  actor.root.position.set(hero.pos.x, 0, hero.pos.y);
  actor.turn = turnTowards(actor.turn, hero.facing, dt, TURN_RATE);
  actor.root.rotation.y = actor.turn;

  const name = HERO_CLIPS[hero.animation.clip];
  blendClips(actor.actions, name, dt, first);
  const action = actor.actions.get(name);
  if (action) {
    action.time = scrubTime(hero.animation, action.getClip().duration);
  }
  actor.mixer.update(0);
}
