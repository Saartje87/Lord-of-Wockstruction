import { writeFileSync } from "node:fs";
import { COMPASS, readAnimations } from "./flare.mts";
import { blankImage, blit, pack, readPng, writePng } from "./image.mts";

/**
 * Bakes a Flare power's flying art into an atlas holding only its frames
 * facing screen east, and writes it with a Pixi spritesheet next to it as
 * `<outDir>/<name>.png|json`. The game rotates that one direction to any
 * direction of flight.
 *
 * Frames are named `<name>/fly/<i>` and listed under `animations.fly`, each
 * anchored on the point Flare places on the Projectile's position along its
 * length, and halfway up. `meta.timing.fly` gives the frame time, and
 * `meta.height` how far above the ground Flare draws it (px).
 */
export function importProjectile(opts: {
  name: string;
  modDir: string;
  /** Path of the Flare animation definition, relative to the mod. */
  animations: string;
  outDir: string;
}) {
  const def = readAnimations(`${opts.modDir}/${opts.animations}`);
  const image = readPng(`${opts.modDir}/${def.image}`);
  const [name, anim] = [...def.animations][0];
  if (!anim) throw new Error(`${opts.name} has no animation`);
  const east = COMPASS.indexOf("e");
  const rects = anim.rects.map((frame, i) => {
    const rect = frame[east];
    if (!rect) throw new Error(`${opts.name} ${name} has no frame ${i} east`);
    return rect;
  });

  const { positions, width, height } = pack(rects);
  const atlas = blankImage(width, height);
  const frames: Record<string, unknown> = {};
  const keys: string[] = [];
  rects.forEach((rect, i) => {
    const { x, y } = positions[i];
    blit(image, rect, atlas, x, y);
    const key = `${opts.name}/fly/${i}`;
    keys.push(key);
    const size = { x: 0, y: 0, w: rect.w, h: rect.h };
    frames[key] = {
      frame: { x, y, w: rect.w, h: rect.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: size,
      sourceSize: { w: rect.w, h: rect.h },
      anchor: { x: rect.ox / rect.w, y: 0.5 },
    };
  });

  writePng(`${opts.outDir}/${opts.name}.png`, atlas);
  const first = rects[0];
  const sheet = {
    frames,
    animations: { fly: keys },
    meta: {
      image: `${opts.name}.png`,
      format: "RGBA8888",
      size: { w: width, h: height },
      scale: 1,
      timing: {
        fly: { frameMs: anim.durationMs / anim.frames, loop: true },
      },
      height: first.oy - first.h / 2,
    },
  };
  writeFileSync(
    `${opts.outDir}/${opts.name}.json`,
    `${JSON.stringify(sheet)}\n`,
  );
  console.log(`${opts.name}: ${rects.length} frames, ${width}×${height}`);
}
