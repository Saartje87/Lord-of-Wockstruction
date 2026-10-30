import { type PieceSource, pieceName } from "./pieces.mts";

/** The side of a tile's thumbnail, in pixels. */
export const THUMBNAIL_SIZE = 128;

/** Where a piece's thumbnail is, relative to `content/tilesets/`. */
export function thumbnailOf(source: PieceSource): string {
  return `kaykit/${pieceName(source).replace("/", "_")}.png`;
}

/**
 * The Water tile, after the last piece: it has no KayKit model, as the 3D
 * World draws each pond as a plane in code, and a hand-made thumbnail.
 */
const WATER_TILE = {
  image: "kaykit/water.png",
  imagewidth: THUMBNAIL_SIZE,
  imageheight: THUMBNAIL_SIZE,
  properties: [
    { name: "blocks", type: "bool", value: false },
    { name: "kind", type: "string", value: "water" },
    { name: "piece", type: "string", value: "water" },
  ],
};

/**
 * The KayKit tileset as Tiled's `.tsj`: a collection of images, one tile per
 * piece in order, each with the properties `piece`, `blocks` and `kind`, then
 * the Water tile.
 */
export function tilesetOf(pieces: PieceSource[]) {
  return {
    type: "tileset",
    version: "1.10",
    name: "kaykit",
    tilewidth: THUMBNAIL_SIZE,
    tileheight: THUMBNAIL_SIZE,
    tilecount: pieces.length + 1,
    columns: 0,
    margin: 0,
    spacing: 0,
    grid: { orientation: "isometric", width: 192, height: 96 },
    tiles: pieces
      .map((source, id) => ({
        id,
        image: thumbnailOf(source),
        imagewidth: THUMBNAIL_SIZE,
        imageheight: THUMBNAIL_SIZE,
        properties: [
          { name: "blocks", type: "bool", value: source.blocks },
          { name: "kind", type: "string", value: source.kind },
          { name: "piece", type: "string", value: pieceName(source) },
        ],
      }))
      .concat([{ id: pieces.length, ...WATER_TILE }]),
  };
}
