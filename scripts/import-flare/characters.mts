import { writeFileSync } from "node:fs";
import {
  COMPASS,
  type Compass,
  type FlareAnimation,
  readAnimations,
} from "./flare.mts";
import {
  blankImage,
  blit,
  type Image,
  pack,
  readPng,
  writePng,
} from "./image.mts";

/** The only animations the game plays. */
export const ANIMATIONS = ["stance", "run", "swing", "hit", "die"] as const;

/** The animations the game loops; the rest play once and hold. */
const LOOPED = new Set<string>(["stance", "run"]);

export type CharacterLayer = {
  /** The equipment slot, as named in `engine/hero_layers.txt`. */
  slot: string;
  /** Path of the Flare animation definition, relative to the mod. */
  animations: string;
};

type Layer = {
  slot: string;
  image: Image;
  animations: Map<string, FlareAnimation>;
};

/**
 * Bakes a character's layers into one atlas holding only `ANIMATIONS`, and
 * writes it with a Pixi spritesheet next to it as `<outDir>/<name>.png|json`.
 *
 * Frames are named `<name>/<animation>_<compass>/<i>` and listed under
 * `animations["<animation>_<compass>"]`. `back_forth` animations are unrolled
 * into one forward-then-back pass. `meta.timing` gives each animation's
 * Flare frame time and whether the game loops it.
 */
export function importCharacter(opts: {
  name: string;
  modDir: string;
  layers: CharacterLayer[];
  /** Per direction, the slots back to front. Unset for a single layer. */
  drawOrder?: Map<Compass, string[]>;
  outDir: string;
}) {
  const layers: Layer[] = opts.layers.map(({ slot, animations }) => {
    const def = readAnimations(`${opts.modDir}/${animations}`);
    return {
      slot,
      image: readPng(`${opts.modDir}/${def.image}`),
      animations: def.animations,
    };
  });
  const base = layers[0].animations;

  // Compose every frame we keep into its own image first, then pack them.
  const frames: {
    key: string;
    image: Image;
    anchor: { x: number; y: number };
  }[] = [];
  const animations: Record<string, string[]> = {};
  const timing: Record<string, { frameMs: number; loop: boolean }> = {};

  for (const name of ANIMATIONS) {
    const anim = base.get(name);
    if (!anim) throw new Error(`${opts.name} has no ${name} animation`);
    timing[name] = {
      frameMs: anim.durationMs / anim.frames,
      loop: LOOPED.has(name),
    };

    COMPASS.forEach((compass, dir) => {
      const order = opts.drawOrder?.get(compass) ?? layers.map((l) => l.slot);
      const stack = order.flatMap((slot) =>
        layers.filter((l) => l.slot === slot),
      );
      const keys: string[] = [];
      for (let i = 0; i < anim.frames; i++) {
        const key = `${opts.name}/${name}_${compass}/${i}`;
        frames.push({ key, ...composeFrame(stack, name, i, dir) });
        keys.push(key);
      }
      if (anim.type === "back_forth") keys.push(...keys.slice(1, -1).reverse());
      animations[`${name}_${compass}`] = keys;
    });
  }

  const { positions, width, height } = pack(
    frames.map(({ image }) => ({ w: image.width, h: image.height })),
  );
  const atlas = blankImage(width, height);
  const sheetFrames: Record<string, unknown> = {};
  frames.forEach(({ key, image, anchor }, i) => {
    const { x, y } = positions[i];
    const rect = { x: 0, y: 0, w: image.width, h: image.height };
    blit(image, rect, atlas, x, y);
    sheetFrames[key] = {
      frame: { x, y, w: image.width, h: image.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: rect,
      sourceSize: { w: image.width, h: image.height },
      anchor,
    };
  });

  writePng(`${opts.outDir}/${opts.name}.png`, atlas);
  const sheet = {
    frames: sheetFrames,
    animations,
    meta: {
      image: `${opts.name}.png`,
      format: "RGBA8888",
      size: { w: width, h: height },
      scale: 1,
      timing,
    },
  };
  writeFileSync(
    `${opts.outDir}/${opts.name}.json`,
    `${JSON.stringify(sheet)}\n`,
  );
  console.log(`${opts.name}: ${frames.length} frames, ${width}×${height}`);
}

/**
 * Stacks one frame of every layer, aligned on Flare's offsets (the point
 * that sits on the character's position), into one image just big enough.
 */
function composeFrame(
  stack: Layer[],
  animation: string,
  index: number,
  dir: number,
) {
  const parts = stack.flatMap((layer) => {
    const rect = layer.animations.get(animation)?.rects[index]?.[dir];
    return rect && rect.w > 0 && rect.h > 0 ? [{ layer, rect }] : [];
  });
  if (parts.length === 0) {
    throw new Error(
      `No layer has frame ${index} of ${animation}, direction ${dir}`,
    );
  }
  const left = Math.min(...parts.map(({ rect }) => -rect.ox));
  const top = Math.min(...parts.map(({ rect }) => -rect.oy));
  const right = Math.max(...parts.map(({ rect }) => rect.w - rect.ox));
  const bottom = Math.max(...parts.map(({ rect }) => rect.h - rect.oy));

  const image = blankImage(right - left, bottom - top);
  for (const { layer, rect } of parts) {
    blit(layer.image, rect, image, -rect.ox - left, -rect.oy - top);
  }
  return { image, anchor: { x: -left / image.width, y: -top / image.height } };
}
