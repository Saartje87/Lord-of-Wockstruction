import {
  AmbientLight,
  Color,
  DirectionalLight,
  type Group,
  HemisphereLight,
  OrthographicCamera,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Area } from "../sim/area";
import { placeCamera, type WorldCamera } from "./camera";
import { type FloorPieces, floorOf } from "./floor";
import { type HeroActor, heroActorOf, poseHero } from "./heroActor";
import { createMarkers, type Markers, showMarkers } from "./markers";
import { toonShade } from "./toon";
import type { WorldView } from "./view";

/**
 * The 3D World's three.js side. Its renderer owns the canvas and the WebGL
 * context, which Pixi shares to draw the HUD on top (ADR 0004).
 */
export type World3d = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: OrthographicCamera;
  markers: Markers;
  /** Set once `loadModels` is done. */
  models: Models | null;
  /** The Area whose floor is in the scene, if any. */
  shown: { area: Area; floor: Group } | null;
  /** When the last frame was drawn (ms), for easing. */
  drawnAtMs: number | null;
};

/** What the 3D World is made of, loaded. */
type Models = { hero: HeroActor; floorPieces: FloorPieces };

/** Where `import:kaykit` puts the models, served from `public/`. */
const MODELS = "/assets/models";

/** The dark the 3D World is drawn on. */
const BACKGROUND = 0x07060b;

/** Creates the 3D World's renderer, its canvas and an empty scene. */
export function createWorld3d(): World3d {
  // Pixi needs the stencil buffer for its masks.
  const renderer = new WebGLRenderer({ antialias: true, stencil: true });
  const scene = new Scene();
  scene.background = new Color(BACKGROUND);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  // Plain light for now: the gothic look, torches and lantern come later.
  scene.add(new AmbientLight(0x6a5f9a, 0.8));
  scene.add(new HemisphereLight(0x8a9ac8, 0x241a30, 0.7));
  const sun = new DirectionalLight(0xa8b4e0, 1.1);
  sun.position.set(-4, 10, 2);
  scene.add(sun);
  const markers = createMarkers();
  scene.add(markers.click, markers.hover);
  return {
    renderer,
    scene,
    camera,
    markers,
    models: null,
    shown: null,
    drawnAtMs: null,
  };
}

/** Loads the models into the scene: the Hero, and the pieces of the floor. */
export async function loadModels(world3d: World3d) {
  const loader = new GLTFLoader();
  const load = (path: string) => loader.loadAsync(`${MODELS}/${path}.glb`);
  const [knight, plain, broken, dirt] = await Promise.all([
    load("characters/Knight"),
    load("dungeon/floor_tile_large"),
    load("dungeon/floor_tile_small_broken_A"),
    load("dungeon/floor_dirt_large"),
  ]);
  const floorPieces = {
    plain: plain.scene,
    broken: broken.scene,
    dirt: dirt.scene,
  };
  for (const piece of Object.values(floorPieces)) toonShade(piece);
  const hero = heroActorOf(knight);
  world3d.scene.add(hero.root);
  world3d.models = { hero, floorPieces };
}

/** Puts `area`'s floor in the scene in place of the last Area's. */
function showFloor(world3d: World3d, area: Area) {
  if (world3d.shown?.area === area || !world3d.models) return;
  if (world3d.shown) world3d.scene.remove(world3d.shown.floor);
  const floor = floorOf(area, world3d.models.floorPieces);
  world3d.scene.add(floor);
  world3d.shown = { area, floor };
}

/** The size three.js last drew at, reused each frame. */
const drawnSize = new Vector2();

/**
 * Draws the 3D World into the shared canvas, as `view` shows it from
 * `camera` in `area`, `width` × `height` CSS px at `resolution`, as Pixi
 * sized it. Pixi then draws the HUD over it.
 */
export function drawWorld3d(
  world3d: World3d,
  frame: {
    area: Area;
    view: WorldView;
    camera: WorldCamera;
    nowMs: number;
    resolution: number;
  },
) {
  const { renderer, scene } = world3d;
  const { area, view, camera, nowMs, resolution } = frame;
  const { width, height } = camera;
  if (renderer.getPixelRatio() !== resolution) {
    renderer.setPixelRatio(resolution);
  }
  // Pixi owns the canvas's size and style, so three.js only follows it.
  const size = renderer.getSize(drawnSize);
  if (size.x !== width || size.y !== height) {
    renderer.setSize(width, height, false);
  }
  showFloor(world3d, area);
  const dt =
    world3d.drawnAtMs === null ? 0 : (nowMs - world3d.drawnAtMs) / 1000;
  world3d.drawnAtMs = nowMs;
  if (world3d.models) poseHero(world3d.models.hero, view.hero, dt);
  showMarkers(world3d.markers, view);
  placeCamera(world3d.camera, camera);
  renderer.resetState();
  renderer.render(scene, world3d.camera);
}

/** The WebGL context Pixi shares to draw the HUD over the 3D World. */
export function contextOf(world3d: World3d): WebGL2RenderingContext {
  // three.js only creates WebGL2 contexts, though its type allows WebGL1.
  return world3d.renderer.getContext() as WebGL2RenderingContext;
}

/** What the 3D World drew last frame, for the stats panel. */
export function drawnBy(world3d: World3d) {
  const { calls, triangles } = world3d.renderer.info.render;
  return { calls, triangles };
}

/**
 * Frees the 3D World's renderer and its WebGL context, once Pixi is done
 * with it, so remounts don't pile up contexts.
 */
export function disposeOf(world3d: World3d) {
  world3d.renderer.dispose();
  world3d.renderer.forceContextLoss();
}
