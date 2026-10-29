import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PointLight,
  type Scene,
} from "three";
import type { Vec } from "../sim/vec";
import { flicker, nearestLit } from "./lights";
import type { WorldView } from "./view";

/**
 * How many torches light the World at once. The scene holds this many point
 * lights from the start, whatever the Area has, and only moves them about:
 * adding or removing a light would recompile every shader.
 */
export const TORCH_LIGHTS = 4;

/** The brightest a torch's light gets. */
const TORCH_INTENSITY = 2.6;

/** The scene's lights. */
export type Lighting = {
  lantern: PointLight;
  torches: PointLight[];
};

/** Adds the dark, cold ambient light, the Hero's lantern and the torch pool. */
export function createLighting(scene: Scene): Lighting {
  scene.add(new AmbientLight(0x4c4378, 0.8));
  scene.add(new HemisphereLight(0x586496, 0x120a1a, 0.55));
  const moon = new DirectionalLight(0x7f8cc4, 0.4);
  moon.position.set(-4, 10, 2);
  scene.add(moon);
  const lantern = new PointLight(0xffb878, 3.0, 7.5, 1.6);
  scene.add(lantern);
  const torches = Array.from({ length: TORCH_LIGHTS }, () => {
    const light = new PointLight(0xff7a2a, 0, 6, 1.5);
    scene.add(light);
    return light;
  });
  return { lantern, torches };
}

/** How high the Hero's lantern hangs and where a torch's flame is. */
export const LANTERN_HEIGHT = 1.5;
export const FLAME_HEIGHT = 0.85;

/**
 * Puts the lantern on the Hero and the torch lights on the lit torches
 * nearest them, flickering; the lights left over are dimmed to nothing.
 */
export function lightScene(
  lighting: Lighting,
  view: Pick<WorldView, "torches"> & { hero: { pos: Vec } },
  seconds: number,
) {
  const { pos } = view.hero;
  lighting.lantern.position.set(pos.x, LANTERN_HEIGHT, pos.y);
  lighting.lantern.intensity = 3.0 * (0.94 + 0.06 * flicker(seconds, 0.5));
  const chosen = nearestLit(view.torches, pos, lighting.torches.length);
  lighting.torches.forEach((light, i) => {
    const torch = view.torches[chosen[i]];
    if (!torch) {
      light.intensity = 0;
      return;
    }
    // A little out from the flame, so the Wall behind it is lit as well.
    const out = torch.turn === 0 ? { x: 0, y: 0.2 } : { x: 0.2, y: 0 };
    light.position.set(torch.pos.x + out.x, FLAME_HEIGHT, torch.pos.y + out.y);
    light.intensity = TORCH_INTENSITY * flicker(seconds, torch.wall);
  });
}
