import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

/** An RGBA image held in memory, 4 bytes per pixel. */
export type Image = { width: number; height: number; data: Buffer };

export type Rect = { x: number; y: number; w: number; h: number };

export function readPng(path: string): Image {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: png.data };
}

export function writePng(path: string, image: Image) {
  const png = new PNG({ width: image.width, height: image.height });
  image.data.copy(png.data);
  writeFileSync(path, PNG.sync.write(png));
}

export function blankImage(width: number, height: number): Image {
  return { width, height, data: Buffer.alloc(width * height * 4) };
}

/**
 * Draws `rect` of `src` onto `dst` with its top-left at (`dx`, `dy`),
 * alpha-blended over what is already there.
 */
export function blit(
  src: Image,
  rect: Rect,
  dst: Image,
  dx: number,
  dy: number,
) {
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const s = ((rect.y + y) * src.width + rect.x + x) * 4;
      const d = ((dy + y) * dst.width + dx + x) * 4;
      const sa = src.data[s + 3] / 255;
      if (sa === 0) continue;
      const da = dst.data[d + 3] / 255;
      const oa = sa + da * (1 - sa);
      for (let c = 0; c < 3; c++) {
        dst.data[d + c] = Math.round(
          (src.data[s + c] * sa + dst.data[d + c] * da * (1 - sa)) / oa,
        );
      }
      dst.data[d + 3] = Math.round(oa * 255);
    }
  }
}

/**
 * Places rects of the given sizes into one atlas, in shelves sorted by
 * height, with `padding` px between them. Returns positions in input order.
 */
export function pack(
  sizes: { w: number; h: number }[],
  { maxSize = 4096, padding = 2 } = {},
): { positions: { x: number; y: number }[]; width: number; height: number } {
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b].h - sizes[a].h);
  const positions: { x: number; y: number }[] = new Array(sizes.length);
  let x = 0;
  let y = 0;
  let shelf = 0;
  let width = 0;
  for (const i of order) {
    const { w, h } = sizes[i];
    if (x + w > maxSize) {
      x = 0;
      y += shelf + padding;
      shelf = 0;
    }
    positions[i] = { x, y };
    x += w + padding;
    width = Math.max(width, x - padding);
    shelf = Math.max(shelf, h);
  }
  const height = y + shelf;
  if (height > maxSize) {
    throw new Error(`Atlas is ${width}×${height}, over the ${maxSize} limit`);
  }
  return { positions, width, height };
}
