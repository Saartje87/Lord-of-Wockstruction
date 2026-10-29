"use client";

// PROTOTYPE, throwaway. Question: does a real-time 3D renderer (three.js +
// KayKit CC0 models) give Wiablo a gothic-cartoon, Torchlight-like look, and
// does it run smoothly on a mid-range phone? It drives the real simulation
// (`src/game/sim`) and only replaces the drawing. Knobs are URL params, set
// from the bar at the bottom: look, outline, shadows, lights, dpr, area.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import {
  type GLTF,
  GLTFLoader,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { areas, tilesets } from "../content";
import type { Area } from "../sim/area";
import { msToSteps } from "../sim/units";
import {
  createWorld,
  HIT_STEP,
  type Monster,
  type MonsterId,
  maxLife,
  type Order,
  SWING_STEPS,
  step,
  type World,
} from "../sim/world";
import { monsterTuning } from "../tuning/monsters";

const ASSETS = "/prototype-3d/";
/** KayKit dungeon pieces are 4 units to a large floor tile; ours is 1. */
const PIECE = 0.25;
/** Walls a bit taller than KayKit's, for a crypt feel. */
const WALL_HEIGHT = 0.32;
/** Characters a bit larger than the pieces, as Torchlight does. */
const CHARACTER = 0.36;
/** 30° down: Flare's 2:1 diamonds, so the scale matches the 2D game. */
const ELEVATION = Math.PI / 6;

type Settings = {
  look: "toon" | "standard";
  outline: boolean;
  shadows: boolean;
  lights: number;
  dpr: number;
  area: string;
};

function readSettings(): Settings {
  const p = new URLSearchParams(location.search);
  return {
    look: p.get("look") === "standard" ? "standard" : "toon",
    outline: p.get("outline") !== "0",
    shadows: p.get("shadows") === "1",
    lights: Number(p.get("lights") ?? 4),
    dpr: Number(p.get("dpr") ?? Math.min(devicePixelRatio, 2)),
    area: p.get("area") ?? "catacombs",
  };
}

type Stats = {
  fps: number;
  ms: number;
  calls: number;
  triangles: number;
  monsters: number;
  area: string;
  size: string;
};

export default function Prototype3d() {
  const mount = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [fade, setFade] = useState(0);
  const [settings] = useState(readSettings);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let stopped = false;
    let cleanup = () => {};
    start(host, settings, setStats, setFade, () => stopped).then((stop) => {
      if (stopped) stop();
      else cleanup = stop;
    });
    return () => {
      stopped = true;
      cleanup();
    };
  }, [settings]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#07060b" }}>
      <div ref={mount} style={{ position: "absolute", inset: 0 }} />
      {/* Vignette and the Area change fade. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgba(4,2,10,0.85) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "#000",
          opacity: fade,
        }}
      />
      <StatsPanel stats={stats} settings={settings} />
      <SettingsBar settings={settings} />
    </div>
  );
}

function StatsPanel({
  stats,
  settings,
}: {
  stats: Stats | null;
  settings: Settings;
}) {
  return (
    <pre
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        margin: 0,
        padding: "6px 8px",
        font: "12px/1.4 ui-monospace, monospace",
        color: "#e8dcc8",
        background: "rgba(0,0,0,0.55)",
        borderRadius: 6,
        pointerEvents: "none",
      }}
    >
      {stats
        ? `PROTOTYPE 3D\n${stats.fps.toFixed(0)} fps  ${stats.ms.toFixed(1)} ms/frame\n${stats.calls} draw calls  ${(stats.triangles / 1000).toFixed(0)}k tris\n${stats.size} @ dpr ${settings.dpr}\n${stats.area}: ${stats.monsters} Monsters`
        : "Loading models…"}
    </pre>
  );
}

function SettingsBar({ settings }: { settings: Settings }) {
  const go = (change: Partial<Record<string, string>>) => {
    const p = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(change)) if (v) p.set(k, v);
    location.search = p.toString();
  };
  const button = (
    label: string,
    on: boolean,
    change: Record<string, string>,
  ) => (
    <button
      key={label}
      type="button"
      onClick={() => go(change)}
      style={{
        padding: "6px 10px",
        borderRadius: 6,
        border: "1px solid #6b4a2a",
        background: on ? "#c8742a" : "#1d1712",
        color: on ? "#120c06" : "#e8dcc8",
        font: "12px ui-monospace, monospace",
      }}
    >
      {label}
    </button>
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        right: 8,
        bottom: 8,
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        justifyContent: "center",
      }}
    >
      {button("toon", settings.look === "toon", { look: "toon" })}
      {button("standard", settings.look === "standard", { look: "standard" })}
      {button("outline", settings.outline, {
        outline: settings.outline ? "0" : "1",
      })}
      {button("shadows", settings.shadows, {
        shadows: settings.shadows ? "0" : "1",
      })}
      {[0, 2, 4, 8].map((n) =>
        button(`${n} torches`, settings.lights === n, { lights: String(n) }),
      )}
      {[1, 2].map((d) =>
        button(`dpr ${d}`, settings.dpr === d, { dpr: String(d) }),
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The scene

type Models = Record<string, GLTF>;

const MODEL_FILES = [
  "floor_tile_large.glb",
  "floor_tile_small_broken_A.glb",
  "floor_tile_small_decorated.glb",
  "floor_dirt_large.glb",
  "wall.glb",
  "wall_cracked.glb",
  "wall_broken.glb",
  "pillar.glb",
  "pillar_decorated.glb",
  "column.glb",
  "barrel_large.glb",
  "chest.glb",
  "candle_triple.glb",
  "torch_mounted.glb",
  "Knight.glb",
  "Skeleton_Warrior.glb",
  "Skeleton_Minion.glb",
  "Skeleton_Rogue.glb",
  "Skeleton_Blade.gltf",
  "Skeleton_Axe.gltf",
  "Skeleton_Shield_Small_A.gltf",
  "Skeleton_Crossbow.gltf",
];

const GRADIENT = (() => {
  const t = new THREE.DataTexture(
    new Uint8Array([70, 150, 255]),
    3,
    1,
    THREE.RedFormat,
  );
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const OUTLINE = { thickness: 0.006, color: [0.03, 0.02, 0.05] };

function restyle(model: THREE.Object3D, settings: Settings, outline: boolean) {
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const old = o.material as THREE.MeshStandardMaterial;
    const material =
      settings.look === "toon"
        ? new THREE.MeshToonMaterial({
            map: old.map,
            color: old.color,
            gradientMap: GRADIENT,
            transparent: old.transparent,
            alphaTest: old.alphaTest,
          })
        : old;
    material.userData.outlineParameters = outline
      ? OUTLINE
      : { visible: false };
    o.material = material;
    o.castShadow = settings.shadows;
    o.receiveShadow = settings.shadows;
  });
}

/** Every mesh of a model with its transform, for instancing. */
function partsOf(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const parts: {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    local: THREE.Matrix4;
  }[] = [];
  model.traverse((o) => {
    if (o instanceof THREE.Mesh)
      parts.push({
        geometry: o.geometry,
        material: o.material,
        local: o.matrixWorld.clone(),
      });
  });
  return parts;
}

function instanced(
  model: THREE.Object3D,
  matrices: THREE.Matrix4[],
  settings: Settings,
): THREE.InstancedMesh[] {
  if (matrices.length === 0) return [];
  return partsOf(model).map((part) => {
    const mesh = new THREE.InstancedMesh(
      part.geometry,
      part.material,
      matrices.length,
    );
    const m = new THREE.Matrix4();
    matrices.forEach((cell, i) => {
      mesh.setMatrixAt(i, m.multiplyMatrices(cell, part.local));
    });
    mesh.castShadow = settings.shadows;
    mesh.receiveShadow = settings.shadows;
    return mesh;
  });
}

/** A stable 0..1 per cell, so the same Area always looks the same. */
function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function cellMatrix(
  x: number,
  y: number,
  scale: THREE.Vector3,
  turn = 0,
  lift = 0,
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x + 0.5, lift, y + 0.5),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn),
    scale,
  );
}

type Torch = {
  pos: THREE.Vector3;
  flame: THREE.Mesh;
  model: THREE.Object3D;
  x: number;
  y: number;
  seed: number;
  lit: boolean;
};

type Built = {
  group: THREE.Group;
  torches: Torch[];
  /** The walls, so those between the camera and the Hero can be lowered. */
  walls: {
    meshes: THREE.InstancedMesh[];
    parts: THREE.Matrix4[];
    cells: { x: number; y: number; base: THREE.Matrix4 }[];
  }[];
};

function buildArea(area: Area, models: Models, settings: Settings): Built {
  const group = new THREE.Group();
  const at = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < area.width && y < area.height
      ? y * area.width + x
      : -1;
  const isFloor = (x: number, y: number) => {
    const i = at(x, y);
    return i >= 0 && area.floor[i];
  };
  const isWall = (x: number, y: number) => {
    const i = at(x, y);
    return i >= 0 && !area.floor[i] && area.propTiles[i] !== null;
  };

  const floors: Record<string, THREE.Matrix4[]> = {};
  const add = (
    bucket: Record<string, THREE.Matrix4[]>,
    k: string,
    m: THREE.Matrix4,
  ) => {
    bucket[k] ??= [];
    bucket[k].push(m);
  };
  const flat = new THREE.Vector3(PIECE, PIECE, PIECE);
  const small = new THREE.Vector3(PIECE * 2, PIECE * 2, PIECE * 2);
  const wallScale = new THREE.Vector3(PIECE, WALL_HEIGHT, PIECE);
  const props: THREE.Object3D[] = [];
  const torches: Torch[] = [];
  const wallCells: Record<
    string,
    { x: number; y: number; base: THREE.Matrix4 }[]
  > = {};
  const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xffa040 });
  const flameGeometry = new THREE.ConeGeometry(0.045, 0.16, 6);

  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      const i = y * area.width + x;
      if (area.floor[i]) {
        const turn = Math.floor(hash(x, y, 1) * 4) * (Math.PI / 2);
        const r = hash(x, y);
        if (r < 0.08)
          add(
            floors,
            "floor_tile_small_broken_A.glb",
            cellMatrix(x, y, small, turn),
          );
        else if (r < 0.16)
          add(floors, "floor_dirt_large.glb", cellMatrix(x, y, flat, turn));
        else add(floors, "floor_tile_large.glb", cellMatrix(x, y, flat, turn));

        const prop = area.propTiles[i];
        if (prop !== null) {
          const blocked = !area.walkable[i];
          const r2 = hash(x, y, 2);
          const name = blocked
            ? r2 < 0.35
              ? "barrel_large.glb"
              : r2 < 0.6
                ? "column.glb"
                : r2 < 0.8
                  ? "pillar_decorated.glb"
                  : "chest.glb"
            : r2 < 0.5
              ? "candle_triple.glb"
              : "floor_tile_small_decorated.glb";
          const model = models[name].scene.clone();
          const s =
            name === "floor_tile_small_decorated.glb" ? PIECE * 2 : PIECE * 1.2;
          model.scale.setScalar(name.startsWith("pillar") ? PIECE * 0.8 : s);
          model.position.set(x + 0.5, 0, y + 0.5);
          model.rotation.y = Math.floor(r2 * 97) * (Math.PI / 2);
          props.push(model);
        }
      } else if (isWall(x, y)) {
        const r = hash(x, y, 3);
        const name =
          r < 0.15
            ? "wall_cracked.glb"
            : r < 0.22
              ? "wall_broken.glb"
              : "wall.glb";
        const along = isWall(x - 1, y) || isWall(x + 1, y);
        const across = isWall(x, y - 1) || isWall(x, y + 1);
        wallCells[name] ??= [];
        if (along || !across)
          wallCells[name].push({
            x,
            y,
            base: cellMatrix(x, y, wallScale),
          });
        if (across)
          wallCells[name].push({
            x,
            y,
            base: cellMatrix(x, y, wallScale, Math.PI / 2),
          });
        if (along && across) {
          const pillar = models["pillar.glb"].scene.clone();
          pillar.position.set(x + 0.5, 0, y + 0.5);
          pillar.scale.set(PIECE * 0.45, WALL_HEIGHT * 1.05, PIECE * 0.45);
          props.push(pillar);
        }

        // Torches on the walls facing the camera.
        const facing = isFloor(x, y + 1)
          ? 0
          : isFloor(x + 1, y)
            ? Math.PI / 2
            : null;
        if (facing !== null && hash(x, y, 4) < 0.14) {
          const torch = models["torch_mounted.glb"].scene.clone();
          torch.scale.setScalar(PIECE * 1.1);
          const out = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
          torch.position.set(x + 0.5, 0.75, y + 0.5).addScaledVector(out, 0.12);
          torch.rotation.y = facing;
          props.push(torch);
          const flame = new THREE.Mesh(flameGeometry, flameMaterial);
          flame.position.copy(torch.position).addScaledVector(out, 0.1);
          flame.position.y += 0.2;
          group.add(flame);
          torches.push({
            pos: flame.position.clone().addScaledVector(out, 0.15),
            flame,
            model: torch,
            x,
            y,
            seed: hash(x, y, 5) * 100,
            lit: true,
          });
        }
      }
    }
  }

  for (const [name, matrices] of Object.entries(floors)) {
    for (const mesh of instanced(models[name].scene, matrices, settings)) {
      mesh.castShadow = false;
      group.add(mesh);
    }
  }
  const walls: Built["walls"] = [];
  for (const [name, cells] of Object.entries(wallCells)) {
    const parts = partsOf(models[name].scene).map((p) => p.local);
    const meshes = instanced(
      models[name].scene,
      cells.map((c) => c.base),
      settings,
    );
    for (const mesh of meshes) group.add(mesh);
    walls.push({ meshes, parts, cells });
  }
  for (const p of props) group.add(p);
  return { group, torches, walls };
}

// ---------------------------------------------------------------------------
// Characters

type Actor = {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationClip>;
  action: THREE.AnimationAction | null;
  clip: string;
  materials: THREE.MeshToonMaterial[];
  flash: number;
  facing: number;
  dead: boolean;
};

function makeActor(
  template: GLTF,
  options: {
    keep?: (name: string) => boolean;
    right?: THREE.Object3D;
    left?: THREE.Object3D;
    tint?: number;
  },
): Actor {
  const root = SkeletonUtils.clone(template.scene);
  root.scale.setScalar(CHARACTER);
  const materials: THREE.MeshToonMaterial[] = [];
  root.traverse((o) => {
    if (options.keep && o instanceof THREE.Mesh && !options.keep(o.name))
      o.visible = false;
    if (/handslot.?r/i.test(o.name) && options.right)
      o.add(options.right.clone());
    if (/handslot.?l/i.test(o.name) && options.left)
      o.add(options.left.clone());
  });
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = (o.material as THREE.MeshToonMaterial).clone();
    if (options.tint) m.color.multiply(new THREE.Color(options.tint));
    o.material = m;
    materials.push(m);
  });
  return {
    root,
    mixer: new THREE.AnimationMixer(root),
    clips: new Map(template.animations.map((c) => [c.name, c])),
    action: null,
    clip: "",
    materials,
    flash: 0,
    facing: 0,
    dead: false,
  };
}

/** Switches to a clip with a short crossfade; `once` clamps on its last frame. */
function play(actor: Actor, name: string, once = false, fade = 0.12) {
  if (actor.clip === name) return actor.action;
  const clip = actor.clips.get(name);
  if (!clip) return actor.action;
  const next = actor.mixer.clipAction(clip);
  next.reset();
  next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  next.clampWhenFinished = once;
  next.timeScale = 1;
  next.play();
  if (actor.action) actor.action.crossFadeTo(next, fade, false);
  actor.action = next;
  actor.clip = name;
  return next;
}

/** Holds a clip at a point in time, so the sim's step count drives the pose. */
function scrub(actor: Actor, name: string, at: number) {
  const action = play(actor, name, true, 0.06);
  if (!action) return;
  action.timeScale = 0;
  action.time = at * action.getClip().duration;
}

function face(actor: Actor, facing: number, dt: number) {
  // Tile (cos, sin) is three (x, z); the models look down +z.
  const target = Math.PI / 2 - facing;
  let d = target - actor.root.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  actor.root.rotation.y += d * Math.min(1, dt * 18);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// The loop

async function start(
  host: HTMLDivElement,
  settings: Settings,
  setStats: (s: Stats) => void,
  setFade: (f: number) => void,
  stopped: () => boolean,
): Promise<() => void> {
  const loader = new GLTFLoader();
  const loaded = await Promise.all(
    MODEL_FILES.map((f) => loader.loadAsync(ASSETS + f)),
  );
  const models: Models = Object.fromEntries(
    MODEL_FILES.map((f, i) => [f, loaded[i]]),
  );
  if (stopped()) return () => {};
  for (const [name, gltf] of Object.entries(models)) {
    // OutlineEffect ignores instancing, so the instanced floors and walls go without.
    const instancedPiece = name.startsWith("floor") || name.startsWith("wall");
    restyle(gltf.scene, settings, settings.outline && !instancedPiece);
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(settings.dpr);
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = settings.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "none";
  const outline = new OutlineEffect(renderer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060b);
  scene.add(new THREE.AmbientLight(0x50467a, 0.55));
  scene.add(new THREE.HemisphereLight(0x5a6a9a, 0x140c1c, 0.6));
  const moon = new THREE.DirectionalLight(0x8090c8, 0.35);
  moon.position.set(-4, 10, 2);
  scene.add(moon);

  const heroLight = new THREE.PointLight(0xffb070, 3.2, 7, 1.4);
  heroLight.castShadow = settings.shadows;
  heroLight.shadow.mapSize.set(512, 512);
  scene.add(heroLight);
  const torchLights = Array.from({ length: settings.lights }, () => {
    const l = new THREE.PointLight(0xff7a2a, 2.4, 5.5, 1.5);
    scene.add(l);
    return l;
  });

  // Embers drifting up around the Hero.
  const EMBERS = 140;
  const emberPos = new Float32Array(EMBERS * 3);
  const emberLife = new Float32Array(EMBERS);
  const emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(emberPos, 3),
  );
  const embers = new THREE.Points(
    emberGeometry,
    new THREE.PointsMaterial({
      color: 0xff6a20,
      size: 2 * settings.dpr,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  embers.frustumCulled = false;
  scene.add(embers);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h);
    // About the 2D game's scale: 96 px per diamond, 0.707 units of height.
    const viewHeight = Math.min(9, Math.max(5.5, h / 136));
    const viewWidth = (viewHeight * w) / h;
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener("resize", resize);
  const toCamera = new THREE.Vector3(
    Math.cos(ELEVATION) / Math.SQRT2,
    Math.sin(ELEVATION),
    Math.cos(ELEVATION) / Math.SQRT2,
  ).multiplyScalar(30);

  const startArea = settings.area in areas ? settings.area : "catacombs";
  const world: World = createWorld({
    areas,
    tilesets,
    seed: 7,
    start: {
      area: startArea,
      entry: startArea === "town" ? "start" : "from-town",
    },
  });

  let built: Built | null = null;
  let builtName = "";
  const rebuild = () => {
    if (built) scene.remove(built.group);
    built = buildArea(world.areas[world.areaName], models, settings);
    builtName = world.areaName;
    scene.add(built.group);
    for (const a of actors.values()) scene.remove(a.root);
    actors.clear();
  };

  const hero = makeActor(models["Knight.glb"], {
    keep: (n) => !/Shield|2H_Sword|Offhand/.test(n) || n === "Round_Shield",
  });
  scene.add(hero.root);
  const actors = new Map<MonsterId, Actor>();
  const monsterActor = (m: Monster) => {
    const type = m.type;
    const actor =
      type === "skeleton_archer"
        ? makeActor(models["Skeleton_Rogue.glb"], {
            right: models["Skeleton_Crossbow.gltf"].scene,
          })
        : type === "zombie"
          ? makeActor(models["Skeleton_Minion.glb"], {
              right: models["Skeleton_Axe.gltf"].scene,
              tint: 0xa8c890,
            })
          : makeActor(models["Skeleton_Warrior.glb"], {
              right: models["Skeleton_Blade.gltf"].scene,
              left: models["Skeleton_Shield_Small_A.gltf"].scene,
            });
    scene.add(actor.root);
    return actor;
  };
  rebuild();

  const arrows = new THREE.Group();
  scene.add(arrows);
  const arrowGeometry = new THREE.BoxGeometry(0.4, 0.03, 0.03);
  const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xd8c8a0 });

  // Input: tap or click the floor to walk, a Monster to attack; hold to keep walking.
  let orders: Order[] = [];
  let held: { x: number; y: number } | null = null;
  let lastMove = 0;
  const ray = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const groundAt = (px: number, py: number) => {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((px - r.left) / r.width) * 2 - 1,
        -((py - r.top) / r.height) * 2 + 1,
      ),
      camera,
    );
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(ground, p) ? { x: p.x, y: p.z } : null;
  };
  const monsterAt = (px: number, py: number): MonsterId | null => {
    const r = renderer.domElement.getBoundingClientRect();
    let best: MonsterId | null = null;
    let bestD = 44;
    for (const m of world.monsters) {
      const v = new THREE.Vector3(m.pos.x, 0.35, m.pos.y).project(camera);
      const sx = r.left + ((v.x + 1) / 2) * r.width;
      const sy = r.top + ((1 - v.y) / 2) * r.height;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bestD) {
        bestD = d;
        best = m.id;
      }
    }
    return best;
  };
  const down = (e: PointerEvent) => {
    const id = monsterAt(e.clientX, e.clientY);
    if (id !== null) {
      orders.push({ type: "Attack", monster: id });
      held = null;
      return;
    }
    held = { x: e.clientX, y: e.clientY };
    const t = groundAt(e.clientX, e.clientY);
    if (t) orders.push({ type: "MoveTo", target: t });
  };
  const move = (e: PointerEvent) => {
    if (held) held = { x: e.clientX, y: e.clientY };
  };
  const up = () => {
    held = null;
  };
  renderer.domElement.addEventListener("pointerdown", down);
  // For playtesting the prototype from the console.
  Object.assign(window, {
    __proto3d: { world, order: (o: Order) => orders.push(o) },
  });
  addEventListener("pointermove", move);
  addEventListener("pointerup", up);

  const swingClip = "1H_Melee_Attack_Chop";
  let last = performance.now();
  let acc = 0;
  let frames = 0;
  let frameTime = 0;
  let statsAt = last;
  let lastWallCell = "";
  let raf = 0;

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000);
    frameTime += now - last;
    last = now;

    if (held && now - lastMove > 120) {
      const t = groundAt(held.x, held.y);
      if (t) orders.push({ type: "MoveTo", target: t });
      lastMove = now;
    }

    // God mode, so the look can be judged in a fight.
    world.hero.life = maxLife(world);
    acc += dt * 1000;
    while (acc >= 1000 / 60) {
      for (const e of step(world, orders)) {
        if (e.type === "HitLanded") {
          const a = actors.get(e.target);
          if (a) a.flash = 1;
        }
      }
      orders = [];
      acc -= 1000 / 60;
    }
    const alpha = acc / (1000 / 60);
    if (world.areaName !== builtName) rebuild();
    setFade(world.areaChange ? Math.min(1, world.areaChange.elapsed / 20) : 0);

    // Hero
    const h = world.hero;
    const hx = lerp(h.prevPos.x, h.pos.x, alpha);
    const hy = lerp(h.prevPos.y, h.pos.y, alpha);
    hero.root.position.set(hx, 0, hy);
    face(hero, h.facing, dt);
    const heroMoving = h.pos.x !== h.prevPos.x || h.pos.y !== h.prevPos.y;
    if (h.swing) {
      const e = h.swing.elapsed;
      scrub(
        hero,
        swingClip,
        e < HIT_STEP
          ? (e / HIT_STEP) * 0.42
          : 0.42 + ((e - HIT_STEP) / (SWING_STEPS - HIT_STEP)) * 0.58,
      );
    } else if (h.cast || h.opening) play(hero, "Spellcast_Shoot", true);
    else if (h.flinch > 0) play(hero, "Hit_A", true);
    else if (heroMoving) play(hero, "Running_A");
    else play(hero, "Idle");
    hero.mixer.update(dt);

    // Monsters, and the dead lying where they fell.
    const seen = new Set<MonsterId>();
    for (const m of world.monsters) {
      seen.add(m.id);
      let a = actors.get(m.id);
      if (!a) {
        a = monsterActor(m);
        actors.set(m.id, a);
      }
      a.root.position.set(
        lerp(m.prevPos.x, m.pos.x, alpha),
        0,
        lerp(m.prevPos.y, m.pos.y, alpha),
      );
      face(a, m.facing, dt);
      const moving = m.pos.x !== m.prevPos.x || m.pos.y !== m.prevPos.y;
      const windUp = msToSteps(monsterTuning[m.type].windUpMs);
      if (m.state === "windup")
        scrub(
          a,
          m.type === "skeleton_archer" ? "2H_Ranged_Shoot" : swingClip,
          (m.attack / windUp) * 0.42,
        );
      else if (m.state === "recover" && a.action) a.action.timeScale = 1;
      else if (m.flinch > 0) play(a, "Hit_B", true);
      else if (moving) play(a, m.state === "chase" ? "Running_C" : "Walking_A");
      else play(a, m.state === "idle" ? "Idle" : "Idle_Combat");
    }
    const corpses = new Set(world.corpses.map((c) => c.id));
    for (const [id, a] of actors) {
      if (seen.has(id)) continue;
      if (corpses.has(id)) {
        if (!a.dead) {
          a.dead = true;
          play(a, "Death_A", true, 0.05);
        }
      } else {
        scene.remove(a.root);
        actors.delete(id);
      }
    }
    for (const a of actors.values()) {
      a.flash = Math.max(0, a.flash - dt * 6);
      for (const m of a.materials) m.emissive.setScalar(a.flash * 0.9);
      a.mixer.update(dt);
    }

    // Arrows
    arrows.clear();
    for (const p of world.projectiles) {
      const mesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
      mesh.position.set(
        lerp(p.prevPos.x, p.pos.x, alpha),
        0.45,
        lerp(p.prevPos.y, p.pos.y, alpha),
      );
      mesh.rotation.y = -Math.atan2(p.direction.y, p.direction.x);
      arrows.add(mesh);
    }

    // Lower the walls between the camera and the Hero, as Diablo does.
    const b = built as Built | null;
    const cellKey = `${Math.floor(hx)},${Math.floor(hy)}`;
    if (b && cellKey !== lastWallCell) {
      lastWallCell = cellKey;
      const m = new THREE.Matrix4();
      const low = new THREE.Matrix4().makeScale(1, 0.12, 1);
      const inFrontOf = (x: number, y: number) => {
        const dx = x + 0.5 - hx;
        const dy = y + 0.5 - hy;
        return dx + dy > 0.5 && Math.abs(dx - dy) < 5 && dx + dy < 7;
      };
      for (const torch of b.torches) {
        torch.lit = !inFrontOf(torch.x, torch.y);
        torch.model.visible = torch.lit;
        torch.flame.visible = torch.lit;
      }
      for (const w of b.walls) {
        w.cells.forEach((c, i) => {
          const cell = inFrontOf(c.x, c.y)
            ? c.base.clone().multiply(low)
            : c.base;
          w.meshes.forEach((mesh, k) => {
            mesh.setMatrixAt(i, m.multiplyMatrices(cell, w.parts[k]));
            mesh.instanceMatrix.needsUpdate = true;
          });
        });
      }
    }

    // Lights: the Hero's lantern, and the torches nearest to them.
    heroLight.position.set(hx, 1.6, hy);
    if (b) {
      const t = now / 1000;
      const near = b.torches
        .filter((torch) => torch.lit)
        .sort(
          (p, q) =>
            Math.hypot(p.pos.x - hx, p.pos.z - hy) -
            Math.hypot(q.pos.x - hx, q.pos.z - hy),
        )
        .slice(0, torchLights.length);
      torchLights.forEach((l, i) => {
        const torch = near[i];
        if (!torch) {
          l.intensity = 0;
          return;
        }
        const flicker =
          0.8 +
          0.12 * Math.sin(t * 9 + torch.seed) +
          0.08 * Math.sin(t * 23 + torch.seed * 3);
        l.position.copy(torch.pos);
        l.intensity = 2.4 * flicker;
      });
      for (const torch of b.torches) {
        const s = 0.85 + 0.25 * Math.sin(t * 14 + torch.seed);
        torch.flame.scale.set(1, s, 1);
      }
    }

    // Embers
    for (let i = 0; i < EMBERS; i++) {
      emberLife[i] -= dt;
      if (emberLife[i] <= 0) {
        emberLife[i] = 2 + Math.random() * 3;
        emberPos[i * 3] = hx + (Math.random() - 0.5) * 14;
        emberPos[i * 3 + 1] = Math.random() * 0.3;
        emberPos[i * 3 + 2] = hy + (Math.random() - 0.5) * 14;
      }
      emberPos[i * 3] += Math.sin(now / 700 + i) * dt * 0.15;
      emberPos[i * 3 + 1] += dt * 0.35;
    }
    emberGeometry.attributes.position.needsUpdate = true;

    camera.position.set(hx, 0, hy).add(toCamera);
    camera.lookAt(hx, 0, hy);
    if (settings.outline) outline.render(scene, camera);
    else renderer.render(scene, camera);

    frames++;
    if (now - statsAt > 500) {
      setStats({
        fps: (frames * 1000) / (now - statsAt),
        ms: frameTime / frames,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        monsters: world.monsters.length,
        area: world.areaName,
        size: `${renderer.domElement.width}×${renderer.domElement.height}`,
      });
      frames = 0;
      frameTime = 0;
      statsAt = now;
    }
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("resize", resize);
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", up);
    renderer.dispose();
    renderer.domElement.remove();
  };
}
