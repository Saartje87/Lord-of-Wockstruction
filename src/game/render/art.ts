import { Assets, type Spritesheet, type Texture } from "pixi.js";
import { type MonsterType, monsterTuning } from "../tuning/monsters";
import { PROJECTILE_KINDS, type ProjectileKind } from "../tuning/projectiles";
import type { Compass, Timing } from "./animation";

/** The animations the Flare import keeps for every character. */
type EveryAnimation = "stance" | "run" | "swing" | "hit" | "die";

/** The animations some characters also have, such as an archer's `shoot`. */
type ExtraAnimation = "shoot";

/** An animation a character's art may have. */
export type Animation = EveryAnimation | ExtraAnimation;

/** One character's frames and how they play. */
export type CharacterArt = {
  /** Frames by `<animation>_<compass>`, in order. */
  animations: Record<string, Texture[]>;
  timing: Record<EveryAnimation, Timing> &
    Partial<Record<ExtraAnimation, Timing>>;
};

/**
 * A Projectile's frames flying screen east, which the renderer rotates to its
 * direction of flight, and how they play.
 */
export type ProjectileArt = {
  frames: Texture[];
  timing: Timing;
  /** How far above the ground it flies (CSS px). */
  height: number;
};

export type Art = {
  /**
   * Each tileset's tiles by tileset name, then tile id, anchored on the
   * diamond centre.
   */
  tiles: Record<string, Map<number, Texture>>;
  hero: CharacterArt;
  monsters: Record<MonsterType, CharacterArt>;
  projectiles: Record<ProjectileKind, ProjectileArt>;
};

/** What the Flare import writes into a character spritesheet's `meta`. */
type CharacterMeta = {
  timing: Record<Animation, { frameMs: number; loop: boolean }>;
};

/** What the Flare import writes into a Projectile spritesheet's `meta`. */
type ProjectileMeta = {
  timing: { fly: { frameMs: number; loop: boolean } };
  height: number;
};

/**
 * Loads the Flare art for Areas drawn with `tilesets` from `public/assets/`.
 * Atlases are sampled with `nearest` when the canvas resolution is a whole
 * number, so art drawn one pixel per CSS pixel stays sharp on any display
 * that can.
 */
export async function loadArt(
  tilesets: string[],
  resolution: number,
): Promise<Art> {
  const types = Object.keys(monsterTuning) as MonsterType[];
  const character = (name: string) =>
    Assets.load<Spritesheet>(`/assets/characters/${name}.json`);
  const [hero, tilesheets, projectiles, ...monsters] = await Promise.all([
    character("hero"),
    Promise.all(
      tilesets.map((name) =>
        Assets.load<Spritesheet>(`/assets/tilesets/${name}.json`),
      ),
    ),
    Promise.all(
      PROJECTILE_KINDS.map((name) =>
        Assets.load<Spritesheet>(`/assets/projectiles/${name}.json`),
      ),
    ),
    ...types.map(character),
  ]);

  const sheetsOf = tilesheets.map((sheet) => [sheet, ...sheet.linkedSheets]);
  if (Number.isInteger(resolution)) {
    for (const sheet of [
      hero,
      ...monsters,
      ...projectiles,
      ...sheetsOf.flat(),
    ]) {
      sheet.textureSource.scaleMode = "nearest";
    }
  }

  const tiles: Record<string, Map<number, Texture>> = {};
  tilesets.forEach((name, i) => {
    const byId = new Map<number, Texture>();
    for (const sheet of sheetsOf[i]) {
      for (const [key, texture] of Object.entries(sheet.textures)) {
        // Frames are named `<tileset>/<id>`.
        byId.set(Number(key.slice(key.indexOf("/") + 1)), texture);
      }
    }
    tiles[name] = byId;
  });
  return {
    tiles,
    hero: characterArt(hero),
    monsters: Object.fromEntries(
      types.map((type, i) => [type, characterArt(monsters[i])]),
    ) as Record<MonsterType, CharacterArt>,
    projectiles: Object.fromEntries(
      PROJECTILE_KINDS.map((name, i) => [name, projectileArt(projectiles[i])]),
    ) as Record<ProjectileKind, ProjectileArt>,
  };
}

/** A Projectile's art from its imported spritesheet's `fly` frames and meta. */
function projectileArt(sheet: Spritesheet): ProjectileArt {
  const { timing, height } = sheet.data.meta as unknown as ProjectileMeta;
  const frames = (sheet.animations as Record<string, Texture[]>).fly;
  return { frames, timing: { ...timing.fly, frames: frames.length }, height };
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
