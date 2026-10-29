import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  ShaderMaterial,
  TorusGeometry,
} from "three";
import type { ShownTownPortal } from "../render/townPortalLook";
import { townPortalLook } from "../tuning/townPortalLook";

/** How many ends can show at once: one standing, one closing, one to spare. */
const POOL = 3;

/** The gateway's size in tiles: half its width and half its height. */
const HALF_WIDTH = 0.42;
const HALF_HEIGHT = 0.72;
/** The sparks that drift up off the rim. */
const SPARKS = 14;

const hex = (colour: number) =>
  `vec3(${[16, 8, 0].map((s) => (((colour >> s) & 255) / 255).toFixed(3)).join(", ")})`;

/** A swirl of green bands turning inwards, around a pale core, fading at the rim. */
function swirlMaterial(): ShaderMaterial {
  const { colours, arms, twist, swirlTurnsPerSecond } = townPortalLook;
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader:
      "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main() {
        vec2 c = (vUv - 0.5) * 2.0;
        float r = length(c);
        float a = atan(c.y, c.x);
        float turn = uTime * ${swirlTurnsPerSecond.toFixed(3)} * 6.2832;
        float band = 0.5 + 0.5 * sin(${arms.toFixed(1)} * (a + r * ${(twist * 6.2832).toFixed(3)} - turn));
        vec3 colour = mix(${hex(colours.dark)}, ${hex(colours.bright)}, band);
        float core = 1.0 - smoothstep(0.0, 0.45, r);
        colour = mix(colour, ${hex(colours.core)}, core);
        float alpha = (1.0 - smoothstep(0.78, 1.0, r)) * (0.75 + 0.25 * band);
        gl_FragColor = vec4(colour * (0.9 + 0.5 * core), alpha);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });
}

/** A soft pool of green light on the floor round the gateway's foot. */
function poolMaterial(): ShaderMaterial {
  const { glow } = townPortalLook.colours;
  return new ShaderMaterial({
    uniforms: { uAlpha: { value: townPortalLook.glowAlpha } },
    vertexShader:
      "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uAlpha; varying vec2 vUv;
      void main() {
        float r = length((vUv - 0.5) * 2.0);
        float alpha = pow(1.0 - smoothstep(0.0, 1.0, r), 1.6) * uAlpha * 1.6;
        gl_FragColor = vec4(${hex(glow)} * alpha, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

type Gateway = {
  root: Group;
  sparks: Points;
  /** Where each spark is in its rise, 0..1, and where round the rim it left. */
  phase: Float32Array;
};

function gatewayOf(swirl: ShaderMaterial, pool: ShaderMaterial): Gateway {
  const root = new Group();
  // Faces the camera, which looks from tile +x +y.
  const stand = new Group();
  stand.rotation.y = Math.PI / 4;
  stand.position.y = HALF_HEIGHT + 0.06;
  const disc = new Mesh(new CircleGeometry(1, 48), swirl);
  disc.scale.set(HALF_WIDTH, HALF_HEIGHT, 1);
  disc.renderOrder = 3;
  const rim = new Mesh(
    new TorusGeometry(1, 0.055, 8, 48),
    new MeshBasicMaterial({ color: townPortalLook.colours.rim }),
  );
  rim.scale.set(HALF_WIDTH, HALF_HEIGHT, 0.7);
  stand.add(disc, rim);
  const floor = new Mesh(
    new CircleGeometry(townPortalLook.glowRadius, 40),
    pool,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.05;
  floor.renderOrder = 2;
  const sparks = new Points(
    new BufferGeometry().setAttribute(
      "position",
      new BufferAttribute(new Float32Array(SPARKS * 3), 3),
    ),
    new PointsMaterial({
      color: townPortalLook.colours.spark,
      size: 3,
      sizeAttenuation: false,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  sparks.frustumCulled = false;
  sparks.position.y = 0.06;
  root.add(stand, floor, sparks);
  root.visible = false;
  return {
    root,
    sparks,
    phase: Float32Array.from({ length: SPARKS }, (_, i) => i / SPARKS),
  };
}

/** Town Portal ends drawn as glowing gateways standing on the floor. */
export type TownPortalMeshes = {
  group: Group;
  /** Shows the ends in `portals` and hides the gateways left over. */
  show: (portals: ShownTownPortal[], seconds: number) => void;
};

/**
 * A pool of green gateways: an upright swirl in a dark rim, with a pool of
 * light at its foot and sparks rising off it. Both ends of a Town Portal
 * look the same.
 */
export function townPortalMeshesOf(): TownPortalMeshes {
  const swirl = swirlMaterial();
  const pool = poolMaterial();
  const gateways = Array.from({ length: POOL }, () => gatewayOf(swirl, pool));
  const group = new Group();
  for (const gateway of gateways) group.add(gateway.root);
  return {
    group,
    show(portals, seconds) {
      swirl.uniforms.uTime.value = seconds;
      gateways.forEach((gateway, i) => {
        const shown = portals[i];
        gateway.root.visible = shown !== undefined;
        if (!shown) return;
        const { pos, scale } = shown;
        gateway.root.position.set(pos.x, 0, pos.y);
        gateway.root.scale.setScalar(scale);
        const position = gateway.sparks.geometry.getAttribute(
          "position",
        ) as BufferAttribute;
        for (let s = 0; s < SPARKS; s++) {
          const rise = (gateway.phase[s] + seconds * 0.5) % 1;
          // Along the gateway's width, which runs across the camera's view.
          const across = Math.cos(s * 2.4) * HALF_WIDTH * 0.9;
          position.setXYZ(
            s,
            across * Math.SQRT1_2,
            0.1 + rise * HALF_HEIGHT * 2.1,
            -across * Math.SQRT1_2,
          );
        }
        position.needsUpdate = true;
      });
    },
  };
}
