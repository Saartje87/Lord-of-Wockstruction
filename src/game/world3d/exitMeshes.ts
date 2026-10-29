import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import type { ExitView } from "./view";

/** The warm gold of light coming in from the way out. */
const LIGHT = "vec3(1.0, 0.82, 0.45)";

/** How tall the shafts of light over an Exit stand, in tiles. */
const SHAFT_HEIGHT = 3.2;

const VERTEX =
  "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";

function glowMaterial(fragment: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: VERTEX,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main() { ${fragment} }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });
}

/**
 * The glow on the floor of an Exit, breathing, with rings of light drawing
 * in towards its middle like a way to somewhere.
 */
const floorGlow = () =>
  glowMaterial(`
    vec2 c = (vUv - 0.5) * 2.0;
    float d = max(abs(c.x), abs(c.y));
    float edge = 1.0 - smoothstep(0.6, 1.0, d);
    float rings = 0.5 + 0.5 * sin(d * 7.0 + uTime * 2.2);
    float breath = 0.85 + 0.15 * sin(uTime * 1.6);
    float alpha = edge * (0.5 + 0.4 * rings) * breath;
    gl_FragColor = vec4(${LIGHT} * alpha, alpha);`);

/** A shaft of light rising from the Exit, fading out and shimmering upwards. */
const shaftGlow = () =>
  glowMaterial(`
    float across = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
    float up = pow(1.0 - vUv.y, 1.6);
    float shimmer = 0.75 + 0.25 * sin(vUv.y * 9.0 - uTime * 1.8 + vUv.x * 6.0);
    float alpha = across * up * shimmer * 0.9;
    gl_FragColor = vec4(${LIGHT} * alpha, alpha);`);

/** The ways out of an Area, drawn as pools and shafts of warm light. */
export type ExitMeshes = {
  group: Group;
  /** Lets the light breathe, `seconds` into the game. */
  update: (seconds: number) => void;
};

/**
 * A pool of light over the zone of each Exit, with two crossed shafts rising
 * from its middle, so a way out reads from afar in any Area.
 */
export function exitMeshesOf(exits: ExitView[]): ExitMeshes {
  const group = new Group();
  const materials = [floorGlow(), shaftGlow()];
  for (const { x, y, width, height } of exits) {
    const gateway = new Group();
    gateway.position.set(x + width / 2, 0, y + height / 2);
    const pool = new Mesh(new PlaneGeometry(width, height), materials[0]);
    pool.rotation.x = -Math.PI / 2;
    // Above Town's raised paths, which reach 0.05.
    pool.position.y = 0.12;
    pool.renderOrder = 2;
    gateway.add(pool);
    const span = Math.min(width, height) * 0.8;
    for (const turn of [Math.PI / 4, -Math.PI / 4]) {
      const shaft = new Mesh(
        new PlaneGeometry(span, SHAFT_HEIGHT),
        materials[1],
      );
      shaft.position.y = SHAFT_HEIGHT / 2;
      shaft.rotation.y = turn;
      shaft.renderOrder = 3;
      gateway.add(shaft);
    }
    group.add(gateway);
  }
  return {
    group,
    update(seconds) {
      for (const material of materials) material.uniforms.uTime.value = seconds;
    },
  };
}
