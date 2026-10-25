import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { readTileset } from "./flare.mts";
import { blankImage, blit, readPng, writePng } from "./image.mts";

/**
 * Imports one Flare tileset in two forms that share Flare's tile ids:
 *
 * - For the game, the original atlases with a Pixi spritesheet each, in
 *   `<publicDir>/<name>.json` (linked to `<name>-1.json`, … when Flare
 *   splits the tileset over several atlases). Frames are named
 *   `<name>/<id>`, anchored on Flare's offset: the point drawn at the
 *   centre of the tile's diamond.
 * - For Tiled, an image-collection tileset `<tiledDir>/<name>.tsj` with
 *   one image per tile in `<tiledDir>/<name>/`, each tile carrying a bool
 *   `blocks` property. Tiled draws every tile from the same corner of the
 *   diamond, so the images are padded until Flare's offsets line up, and
 *   one `tileoffset` puts that shared point on the centre.
 *
 * Flare's animated tiles (water, torches) come through as their still
 * first frame.
 */
export function importTileset(opts: {
  name: string;
  modDir: string;
  /** Path of the Flare tileset definition, relative to the mod. */
  definition: string;
  blocks: (id: number) => boolean;
  publicDir: string;
  tiledDir: string;
}) {
  const atlases = readTileset(`${opts.modDir}/${opts.definition}`).map(
    (atlas) => ({ ...atlas, pixels: readPng(`${opts.modDir}/${atlas.image}`) }),
  );
  const sheetNames = atlases.map((_, i) =>
    i === 0 ? opts.name : `${opts.name}-${i}`,
  );

  atlases.forEach(({ image, tiles, pixels }, i) => {
    const file = basename(image);
    copyFileSync(`${opts.modDir}/${image}`, `${opts.publicDir}/${file}`);
    const frames = Object.fromEntries(
      tiles.map(({ id, x, y, w, h, ox, oy }) => [
        `${opts.name}/${id}`,
        {
          frame: { x, y, w, h },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w, h },
          sourceSize: { w, h },
          anchor: { x: ox / w, y: oy / h },
        },
      ]),
    );
    const sheet = {
      frames,
      meta: {
        image: file,
        format: "RGBA8888",
        size: { w: pixels.width, h: pixels.height },
        scale: 1,
        ...(i === 0 && atlases.length > 1
          ? { related_multi_packs: sheetNames.slice(1).map((n) => `${n}.json`) }
          : {}),
      },
    };
    writeFileSync(
      `${opts.publicDir}/${sheetNames[i]}.json`,
      `${JSON.stringify(sheet)}\n`,
    );
  });

  // Tiled puts a tile image's bottom-left on the bottom-left of the diamond's
  // bounding box. Pad every image to the same anchor point (`left` px from
  // its left edge, `below` px above its bottom edge).
  const all = atlases.flatMap(({ tiles }) => tiles);
  const left = Math.max(...all.map((t) => t.ox));
  const below = Math.max(...all.map((t) => t.h - t.oy));
  const tileDir = `${opts.tiledDir}/${opts.name}`;
  rmSync(tileDir, { recursive: true, force: true });
  mkdirSync(tileDir, { recursive: true });

  const tiledTiles = atlases.flatMap(({ tiles, pixels }) =>
    tiles.map(({ id, x, y, w, h, ox, oy }) => {
      const padded = blankImage(left - ox + w, oy + below);
      blit(pixels, { x, y, w, h }, padded, left - ox, 0);
      writePng(`${tileDir}/${id}.png`, padded);
      return {
        id,
        image: `${opts.name}/${id}.png`,
        imagewidth: padded.width,
        imageheight: padded.height,
        properties: [{ name: "blocks", type: "bool", value: opts.blocks(id) }],
      };
    }),
  );

  const tileWidth = 192;
  const tileHeight = 96;
  const tsj = {
    type: "tileset",
    version: "1.10",
    name: opts.name,
    tilewidth: Math.max(...tiledTiles.map((t) => t.imagewidth)),
    tileheight: Math.max(...tiledTiles.map((t) => t.imageheight)),
    tilecount: tiledTiles.length,
    columns: 0,
    margin: 0,
    spacing: 0,
    grid: { orientation: "isometric", width: tileWidth, height: tileHeight },
    tileoffset: { x: tileWidth / 2 - left, y: below - tileHeight / 2 },
    tiles: tiledTiles,
  };
  writeFileSync(
    `${opts.tiledDir}/${opts.name}.tsj`,
    `${JSON.stringify(tsj, null, 2)}\n`,
  );
  console.log(
    `${opts.name}: ${tiledTiles.length} tiles in ${atlases.length} atlas(es)`,
  );
}
