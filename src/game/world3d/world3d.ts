import {
  ACESFilmicToneMapping,
  Color,
  Group,
  type Object3D,
  OrthographicCamera,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Area } from "../sim/area";
import { type Atmosphere, createAtmosphere, driftEmbers } from "./atmosphere";
import { placeCamera, type WorldCamera } from "./camera";
import { type FloorPieces, floorOf, PIECE_SCALE } from "./floor";
import { type HeroActor, heroActorOf, poseHero } from "./heroActor";
import { createLighting, type Lighting, lightScene } from "./lighting";
import {
  GEM,
  groundPlacement,
  LOOT_MODELS,
  type Placement,
  projectilePlacements,
} from "./lootLook";
import { type Instances, instancesOf, outlineInstances } from "./lootMeshes";
import { createMarkers, type Markers, showMarkers } from "./markers";
import {
  type MonsterActor,
  type MonsterModels,
  monsterActorOf,
  poseMonster,
} from "./monsterActor";
import { MONSTER_LOOKS } from "./monsterLook";
import { propMeshesOf, scaleOf } from "./propMeshes";
import { LOOKS, lookOf, outline, toonShade } from "./toon";
import { type TorchMeshes, torchMeshesOf } from "./torchMeshes";
import type { WorldView } from "./view";
import { type WallMeshes, wallMeshesOf } from "./wallMeshes";
import { wallPlacementsOf } from "./walls";

/**
 * The 3D World's three.js side. Its renderer owns the canvas and the WebGL
 * context, which Pixi shares to draw the HUD on top (ADR 0004).
 */
export type World3d = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: OrthographicCamera;
  markers: Markers;
  lighting: Lighting;
  atmosphere: Atmosphere;
  /** Set once `loadModels` is done. */
  models: Models | null;
  /** The Area whose floor, Walls and Props are in the scene, if any. */
  shown: {
    area: Area;
    floor: Group;
    /** Null until the pieces the Area's Walls and Props use are loaded. */
    scenery: {
      walls: WallMeshes;
      props: Group;
      torches: TorchMeshes;
    } | null;
  } | null;
  /** The Monsters and Corpses in the scene, by id. */
  monsters: Map<number, MonsterActor>;
  /** The Wall and Prop pieces loaded so far, by piece name. */
  pieces: Record<string, Object3D | undefined>;
  /** The pieces asked for, so each is loaded once. */
  loading: Set<string>;
  /** When the last frame was drawn (ms), for easing. */
  drawnAtMs: number | null;
};

/** What the 3D World is made of, loaded. */
type Models = {
  hero: HeroActor;
  floorPieces: FloorPieces;
  monsters: MonsterModels;
  /** Ground Items and Projectiles, one instanced draw per model. */
  loot: Record<string, Instances>;
};

/** Where `import:kaykit` puts the models, served from `public/`. */
const MODELS = "/assets/models";

/** The dark the 3D World is drawn on. */
const BACKGROUND = 0x07060b;

/** The torch's model, which hangs on Walls. */
const TORCH_PIECE = "dungeon/torch_mounted";

/** How wide the outlines on Walls and Props are, in tiles. */
const OUTLINE = 0.02;

/** Creates the 3D World's renderer, its canvas and an empty scene. */
export function createWorld3d(): World3d {
  // Pixi needs the stencil buffer for its masks.
  const renderer = new WebGLRenderer({ antialias: true, stencil: true });
  renderer.toneMapping = ACESFilmicToneMapping;
  // The vignette draws over the World, so each frame clears by hand.
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  const scene = new Scene();
  scene.background = new Color(BACKGROUND);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  // All the lights exist from the start and only move, so no shader ever
  // recompiles for a light that came or went.
  const lighting = createLighting(scene);
  const atmosphere = createAtmosphere();
  scene.add(atmosphere.embers);
  const markers = createMarkers();
  scene.add(markers.click, markers.hover);
  return {
    renderer,
    scene,
    camera,
    markers,
    lighting,
    atmosphere,
    models: null,
    monsters: new Map(),
    shown: null,
    pieces: {},
    loading: new Set(),
    drawnAtMs: null,
  };
}

/** Loads the models into the scene: the Hero, and the pieces of the floor. */
export async function loadModels(world3d: World3d) {
  const loader = new GLTFLoader();
  const load = (path: string) => loader.loadAsync(`${MODELS}/${path}.glb`);
  const monsterFiles = [
    ...new Set(
      Object.values(MONSTER_LOOKS).flatMap((look) => [
        look.model,
        ...look.weapons.map((weapon) => weapon.model),
      ]),
    ),
  ];
  const [knight, plain, broken, dirt, ...rest] = await Promise.all([
    load("characters/Knight"),
    load("dungeon/floor_tile_large"),
    load("dungeon/floor_tile_small_broken_A"),
    load("dungeon/floor_dirt_large"),
    ...monsterFiles.map((file) => load(`characters/${file}`)),
    ...LOOT_MODELS.map((file) => load(file)),
  ]);
  const monsterGltfs = rest.slice(0, monsterFiles.length);
  const lootGltfs = rest.slice(monsterFiles.length);
  const monsters: MonsterModels = {};
  monsterFiles.forEach((file, i) => {
    monsters[file] = monsterGltfs[i];
  });
  const floorPieces = {
    plain: plain.scene,
    broken: broken.scene,
    dirt: dirt.scene,
  };
  for (const piece of Object.values(floorPieces)) toonShade(piece, LOOKS.stone);
  const hero = heroActorOf(knight);
  world3d.scene.add(hero.root);
  const loot: Record<string, Instances> = {};
  [GEM, ...LOOT_MODELS].forEach((file, i) => {
    const instances = instancesOf(
      file,
      i === 0 ? null : lootGltfs[i - 1].scene,
    );
    outlineInstances(instances, 0.4);
    loot[file] = instances;
    world3d.scene.add(instances.group);
  });
  world3d.models = { hero, floorPieces, monsters, loot };
}

/** Puts `area`'s floor in the scene in place of the last Area's. */
function showFloor(world3d: World3d, area: Area) {
  if (world3d.shown?.area === area || !world3d.models) return;
  const { shown, scene } = world3d;
  if (shown) {
    scene.remove(shown.floor);
    if (shown.scenery) {
      scene.remove(
        shown.scenery.walls.group,
        shown.scenery.props,
        shown.scenery.torches.group,
      );
    }
  }
  const floor = floorOf(area, world3d.models.floorPieces);
  scene.add(floor);
  world3d.shown = { area, floor, scenery: null };
}

/**
 * Puts the shown Area's Walls and Props in the scene once their pieces are
 * loaded, asking for the ones that aren't.
 */
function showScenery(world3d: World3d, view: WorldView) {
  const { shown, pieces, loading } = world3d;
  if (!shown || shown.scenery) return;
  const { area } = shown;
  const names = new Set([
    ...wallPlacementsOf(area.walls).map((placement) => placement.piece),
    ...area.props.map((prop) => prop.piece),
    ...(view.torches.length > 0 ? [TORCH_PIECE] : []),
  ]);
  const missing = [...names].filter((name) => !pieces[name]);
  if (missing.length > 0) {
    const loader = new GLTFLoader();
    for (const name of missing) {
      if (loading.has(name)) continue;
      loading.add(name);
      loader.loadAsync(`${MODELS}/${name}.glb`).then(
        (gltf) => {
          toonShade(gltf.scene, lookOf(name));
          pieces[name] = gltf.scene;
        },
        () => {
          // A piece that won't load is left out; the rest still draws.
          pieces[name] = new Group();
        },
      );
    }
    return;
  }
  const walls = wallMeshesOf(area.walls, pieces);
  const props = propMeshesOf(area.props, pieces);
  const torches = torchMeshesOf(
    view.torches,
    pieces[TORCH_PIECE] ?? new Group(),
  );
  // Floors go without outlines; Walls and Props have them.
  for (const mesh of [...walls.group.children]) {
    outline(mesh, OUTLINE, PIECE_SCALE);
  }
  for (const mesh of [...props.children]) {
    outline(mesh, OUTLINE, scaleOf(mesh.userData.piece));
  }
  world3d.scene.add(walls.group, props, torches.group);
  shown.scenery = { walls, props, torches };
}

/**
 * Puts a Monster or Corpse actor in the scene for each in `view`, posed as it
 * says, and takes away those no longer there.
 */
function poseMonsters(world3d: World3d, view: WorldView, dt: number) {
  const { models, monsters, scene } = world3d;
  if (!models) return;
  const seen = new Set<number>();
  for (const monster of view.monsters) {
    seen.add(monster.id);
    let actor = monsters.get(monster.id);
    if (!actor) {
      actor = monsterActorOf(monster.type, models.monsters);
      monsters.set(monster.id, actor);
      scene.add(actor.root);
    }
    poseMonster(actor, monster, dt);
  }
  for (const [id, actor] of monsters) {
    if (seen.has(id)) continue;
    scene.remove(actor.root);
    // The geometry and textures are the models' own; the materials are not.
    for (const material of actor.materials) material.dispose();
    monsters.delete(id);
  }
}

/** Puts the Ground Items on the floor and the Projectiles in the air. */
function showLoot(models: Models, view: WorldView) {
  const placed: Record<string, Placement[]> = {};
  const add = (placement: Placement) => {
    placed[placement.model] ??= [];
    placed[placement.model].push(placement);
  };
  for (const item of view.groundItems) add(groundPlacement(item));
  for (const projectile of view.projectiles) {
    for (const placement of projectilePlacements(projectile)) add(placement);
  }
  for (const [model, instances] of Object.entries(models.loot)) {
    instances.show(placed[model] ?? []);
  }
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
  showScenery(world3d, view);
  world3d.shown?.scenery?.walls.lower(view.loweredWalls);
  const dt =
    world3d.drawnAtMs === null ? 0 : (nowMs - world3d.drawnAtMs) / 1000;
  world3d.drawnAtMs = nowMs;
  if (world3d.models) poseHero(world3d.models.hero, view.hero, dt);
  poseMonsters(world3d, view, dt);
  if (world3d.models) showLoot(world3d.models, view);
  const seconds = nowMs / 1000;
  world3d.shown?.scenery?.torches.show(view.torches, seconds);
  lightScene(world3d.lighting, view, seconds);
  driftEmbers(world3d.atmosphere, view.hero.pos, dt, view.combat);
  showMarkers(world3d.markers, view);
  placeCamera(world3d.camera, camera);
  renderer.resetState();
  renderer.info.reset();
  renderer.clear();
  renderer.render(scene, world3d.camera);
  if (view.combat) {
    const { vignette } = world3d.atmosphere;
    renderer.render(vignette.scene, vignette.camera);
  }
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
