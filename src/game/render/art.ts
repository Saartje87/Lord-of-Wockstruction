import { Assets, type Spritesheet, type Texture } from "pixi.js";
import type { Compass, Timing } from "./animation";

/** The animations the Flare import keeps for every character. */
export type Animation = "stance" | "run" | "swing" | "hit" | "die";

/** One character's frames and how they play. */
export type CharacterArt = {
  /** Frames by `<animation>_<compass>`, in order. */
  animations: Record<string, Texture[]>;
  timing: Record<Animation, Timing>;
};

export type Art = {
  /** The Area's tileset's tiles by tile id, anchored on the diamond centre. */
  tiles: Map<number, Texture>;
  hero: CharacterArt;
};

/** What the Flare import writes into a character spritesheet's `meta`. */
type CharacterMeta = {
  timing: Record<Animation, { frameMs: number; loop: boolean }>;
};

/**
 * Loads the Flare art an Area needs from `public/assets/`. Atlases are
 * sampled with `nearest` when the canvas resolution is a whole number, so
 * art drawn one pixel per CSS pixel stays sharp on any display that can.
 */
export async function loadArt(
  tileset: string | null,
  resolution: number,
): Promise<Art> {
  const [hero, ...tilesheets] = await Promise.all([
    Assets.load<Spritesheet>("/assets/characters/hero.json"),
    ...(tileset
      ? [Assets.load<Spritesheet>(`/assets/tilesets/${tileset}.json`)]
      : []),
  ]);

  const sheets = [hero, ...tilesheets.flatMap((s) => [s, ...s.linkedSheets])];
  if (Number.isInteger(resolution)) {
    for (const sheet of sheets) sheet.textureSource.scaleMode = "nearest";
  }

  const tiles = new Map<number, Texture>();
  for (const sheet of sheets.slice(1)) {
    for (const [key, texture] of Object.entries(sheet.textures)) {
      // Frames are named `<tileset>/<id>`.
      tiles.set(Number(key.slice(key.indexOf("/") + 1)), texture);
    }
  }
  return { tiles, hero: characterArt(hero) };
}

function characterArt(sheet: Spritesheet): CharacterArt {
  const { timing } = sheet.data.meta as unknown as CharacterMeta;
  const animations = sheet.animations as Record<string, Texture[]>;
  const frames = (animation: Animation) => animations[`${animation}_s`].length;
  return {
    animations,
    timing: Object.fromEntries(
      Object.entries(timing).map(([animation, t]) => [
        animation,
        { ...t, frames: frames(animation as Animation) },
      ]),
    ) as Record<Animation, Timing>,
  };
}

/** The texture of one frame of a character's animation, facing `compass`. */
export function frameOf(
  art: CharacterArt,
  animation: Animation,
  compass: Compass,
  frame: number,
): Texture {
  return art.animations[`${animation}_${compass}`][frame];
}
