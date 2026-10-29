// The scene's actual three.js lights: creates them once, then each frame moves
// them (Hero lantern, torch pool) and sets the mood. Which torches get a light
// and how a flame flickers is decided by the pure maths in lights.ts.

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
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

/** The brightest a torch's (or standing lantern's) light gets. */
const TORCH_INTENSITY = 2.6;
/** The colour of a torch's light. */
const TORCH_COLOUR = 0xff7a2a;
/** How far a torch's light reaches (tiles), and how fast it falls off. */
const TORCH_REACH = 6;
const TORCH_DECAY = 1.5;

/** The Hero's lantern: its colour, brightness, reach (tiles) and falloff. */
const LANTERN_COLOUR = 0xffb878;
const LANTERN_INTENSITY = 3.0;
const LANTERN_REACH = 7.5;
const LANTERN_DECAY = 1.6;
/** How much of the lantern's brightness its flicker takes away at most. */
const LANTERN_FLICKER = 0.06;

/** The scene's lights, and the fog and sky that go with them. */
export type Lighting = {
  ambient: AmbientLight;
  hemisphere: HemisphereLight;
  moon: DirectionalLight;
  lantern: PointLight;
  torches: PointLight[];
  fog: Fog;
};

/** How an Area is lit: the dark of a dungeon, or Town's moonlit dusk. */
type Mood = {
  ambient: { colour: number; intensity: number };
  hemisphere: { sky: number; ground: number; intensity: number };
  moon: { colour: number; intensity: number };
  /** The sky behind the World and the fog that fades into it. */
  sky: number;
  fog: { near: number; far: number };
};

/**
 * The Combat Areas' dark, cold air, and Town's dusk: lighter and bluer, with
 * a little fog that thickens towards the top of the screen (the camera
 * hangs 30 units back, so depth grows up the screen).
 */
const MOODS = {
  combat: {
    ambient: { colour: 0x4c4378, intensity: 0.8 },
    hemisphere: { sky: 0x586496, ground: 0x120a1a, intensity: 0.55 },
    moon: { colour: 0x7f8cc4, intensity: 0.4 },
    sky: 0x07060b,
    // Too far to touch anything: fog is always in the shaders, never seen.
    fog: { near: 4000, far: 5000 },
  },
  town: {
    ambient: { colour: 0x7478bc, intensity: 1.2 },
    hemisphere: { sky: 0x7d8ad0, ground: 0x2a2040, intensity: 0.7 },
    moon: { colour: 0xa9b8f0, intensity: 1.0 },
    sky: 0x14142e,
    fog: { near: 31, far: 54 },
  },
} satisfies Record<string, Mood>;

/** Adds the dark, cold ambient light, the Hero's lantern and the torch pool. */
export function createLighting(scene: Scene): Lighting {
  const mood = MOODS.combat;
  const ambient = new AmbientLight(mood.ambient.colour, mood.ambient.intensity);
  scene.add(ambient);
  const hemisphere = new HemisphereLight(
    mood.hemisphere.sky,
    mood.hemisphere.ground,
    mood.hemisphere.intensity,
  );
  scene.add(hemisphere);
  const moon = new DirectionalLight(mood.moon.colour, mood.moon.intensity);
  moon.position.set(-4, 10, 2);
  scene.add(moon);
  const lantern = new PointLight(
    LANTERN_COLOUR,
    LANTERN_INTENSITY,
    LANTERN_REACH,
    LANTERN_DECAY,
  );
  scene.add(lantern);
  const torches = Array.from({ length: TORCH_LIGHTS }, () => {
    const light = new PointLight(TORCH_COLOUR, 0, TORCH_REACH, TORCH_DECAY);
    scene.add(light);
    return light;
  });
  // Fog is on from the start, so its shader code never has to change.
  const fog = new Fog(mood.sky, mood.fog.near, mood.fog.far);
  scene.fog = fog;
  return { ambient, hemisphere, moon, lantern, torches, fog };
}

/** Sets the air to `combat`'s or Town's mood. */
function moodScene(lighting: Lighting, scene: Scene | null, combat: boolean) {
  const mood = combat ? MOODS.combat : MOODS.town;
  lighting.ambient.color.setHex(mood.ambient.colour);
  lighting.ambient.intensity = mood.ambient.intensity;
  lighting.hemisphere.color.setHex(mood.hemisphere.sky);
  lighting.hemisphere.groundColor.setHex(mood.hemisphere.ground);
  lighting.hemisphere.intensity = mood.hemisphere.intensity;
  lighting.moon.color.setHex(mood.moon.colour);
  lighting.moon.intensity = mood.moon.intensity;
  lighting.fog.color.setHex(mood.sky);
  lighting.fog.near = mood.fog.near;
  lighting.fog.far = mood.fog.far;
  if (scene?.background instanceof Color) scene.background.setHex(mood.sky);
}

/** How high the Hero's lantern hangs and where a torch's flame is. */
export const LANTERN_HEIGHT = 1.5;
export const FLAME_HEIGHT = 0.85;

/** The colour of a standing lantern's light, softer than a torch's. */
const LAMP_COLOUR = 0xffa04a;

/** How high a standing lantern's flame hangs. */
export const LAMP_HEIGHT = 0.6;

/**
 * Puts the lantern on the Hero and the pool's lights on the lit torches and
 * the standing lanterns nearest them, flickering; the lights left over are
 * dimmed to nothing.
 */
export function lightScene(
  lighting: Lighting,
  view: Pick<WorldView, "torches" | "lamps" | "combat"> & {
    hero: { pos: Vec };
  },
  seconds: number,
  scene: Scene | null = null,
) {
  moodScene(lighting, scene, view.combat);
  const { pos } = view.hero;
  lighting.lantern.position.set(pos.x, LANTERN_HEIGHT, pos.y);
  lighting.lantern.intensity =
    LANTERN_INTENSITY *
    (1 - LANTERN_FLICKER + LANTERN_FLICKER * flicker(seconds, 0.5));
  const sources: (
    | (WorldView["torches"][number] & { lamp?: undefined })
    | { pos: Vec; lit: true; lamp: true }
  )[] = [
    ...view.torches,
    ...view.lamps.map(({ pos }) => ({
      pos,
      lit: true as const,
      lamp: true as const,
    })),
  ];
  const chosen = nearestLit(sources, pos, lighting.torches.length);
  lighting.torches.forEach((light, i) => {
    const source = sources[chosen[i]];
    if (!source) {
      light.intensity = 0;
      return;
    }
    if (!source.lamp) {
      light.color.setHex(TORCH_COLOUR);
      // A little out from the flame, so the Wall behind it is lit as well.
      const out = source.turn === 0 ? { x: 0, y: 0.2 } : { x: 0.2, y: 0 };
      light.position.set(
        source.pos.x + out.x,
        FLAME_HEIGHT,
        source.pos.y + out.y,
      );
      light.intensity = TORCH_INTENSITY * flicker(seconds, source.wall);
    } else {
      light.color.setHex(LAMP_COLOUR);
      light.position.set(source.pos.x, LAMP_HEIGHT, source.pos.y);
      light.intensity =
        TORCH_INTENSITY * flicker(seconds, source.pos.x + source.pos.y);
    }
  });
}
