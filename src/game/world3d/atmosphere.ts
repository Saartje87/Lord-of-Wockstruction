import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
} from "three";
import type { Vec } from "../sim/vec";

/** How many embers drift about the Hero. */
const EMBERS = 120;
/** Embers live within this many tiles of the Hero, either way. */
const RANGE = 7;

/** Embers drifting up in a Combat Area, and the vignette over the World. */
export type Atmosphere = {
  embers: Points;
  /** What the vignette is drawn into: render it after the World. */
  vignette: { scene: Scene; camera: OrthographicCamera; quad: Mesh };
  /** Where each ember is: x, y, z, then its age and life in seconds. */
  state: { age: Float32Array; life: Float32Array; seed: Float32Array };
};

export function createAtmosphere(): Atmosphere {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(EMBERS * 3), 3),
  );
  const material = new PointsMaterial({
    color: 0xff6a20,
    size: 3,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const embers = new Points(geometry, material);
  embers.frustumCulled = false;

  const state = {
    age: new Float32Array(EMBERS),
    life: new Float32Array(EMBERS).fill(0),
    seed: Float32Array.from({ length: EMBERS }, Math.random),
  };

  const quad = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({
      transparent: true,
      // A quad over the whole frame, in screen space: it is no part of the
      // scene's depth, so nothing may hide it.
      depthTest: false,
      depthWrite: false,
      vertexShader:
        "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          float edge = length((vUv - 0.5) * vec2(1.25, 1.0)) * 1.45;
          float dark = smoothstep(0.55, 1.2, edge);
          gl_FragColor = vec4(0.02, 0.01, 0.05, dark * 0.8);
        }`,
    }),
  );
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  return {
    embers,
    vignette: {
      scene,
      camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
      quad,
    },
    state,
  };
}

/**
 * Moves the embers `dt` seconds on, around `hero`. They rise, sway, and are
 * born again near the Hero when they fade. Only Combat Areas show them.
 */
export function driftEmbers(
  atmosphere: Atmosphere,
  hero: Vec,
  dt: number,
  shown: boolean,
) {
  const { embers, state } = atmosphere;
  embers.visible = shown;
  atmosphere.vignette.quad.visible = shown;
  if (!shown) return;
  const position = embers.geometry.getAttribute("position") as BufferAttribute;
  for (let i = 0; i < EMBERS; i++) {
    state.age[i] += dt;
    if (state.age[i] >= state.life[i]) {
      state.age[i] = 0;
      state.life[i] = 2 + Math.random() * 3;
      position.setXYZ(
        i,
        hero.x + (Math.random() * 2 - 1) * RANGE,
        Math.random() * 0.3,
        hero.y + (Math.random() * 2 - 1) * RANGE,
      );
    } else {
      position.setXYZ(
        i,
        position.getX(i) +
          Math.sin(state.age[i] * 1.4 + state.seed[i] * 40) * dt * 0.15,
        position.getY(i) + dt * 0.35,
        position.getZ(i) +
          Math.cos(state.age[i] * 1.1 + state.seed[i] * 40) * dt * 0.1,
      );
    }
  }
  position.needsUpdate = true;
}
