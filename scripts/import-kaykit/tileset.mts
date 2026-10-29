import { type PieceSource, pieceName } from "./pieces.mts";

/** The side of a tile's thumbnail, in pixels. */
export const THUMBNAIL_SIZE = 128;

/** Where a piece's thumbnail is, relative to `content/tilesets/`. */
export function thumbnailOf(source: PieceSource): string {
  return `kaykit/${pieceName(source).replace("/", "_")}.png`;
}

/**
 * The KayKit tileset as Tiled's `.tsj`: a collection of images, one tile per
 * piece in order, each with the properties `piece`, `blocks` and `kind`.
 */
export function tilesetOf(pieces: PieceSource[]) {
  return {
    type: "tileset",
    version: "1.10",
    name: "kaykit",
    tilewidth: THUMBNAIL_SIZE,
    tileheight: THUMBNAIL_SIZE,
    tilecount: pieces.length,
    columns: 0,
    margin: 0,
    spacing: 0,
    grid: { orientation: "isometric", width: 192, height: 96 },
    tiles: pieces.map((source, id) => ({
      id,
      image: thumbnailOf(source),
      imagewidth: THUMBNAIL_SIZE,
      imageheight: THUMBNAIL_SIZE,
      properties: [
        { name: "blocks", type: "bool", value: source.blocks },
        { name: "kind", type: "string", value: source.kind },
        { name: "piece", type: "string", value: pieceName(source) },
      ],
    })),
  };
}
