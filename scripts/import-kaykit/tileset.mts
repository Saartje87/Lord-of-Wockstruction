import { type PieceSource, pieceName } from "./pieces.mts";

/** The side of a tile's thumbnail, in pixels. */
export const THUMBNAIL_SIZE = 128;

/** Where a piece's thumbnail is, relative to `content/tilesets/`. */
export function thumbnailOf(source: PieceSource): string {
  return `kaykit/${pieceName(source).replace("/", "_")}.png`;
}

/** The `kind` of the Water tile: `WATER_KIND` in `src/game/sim/area.ts`. */
const WATER_KIND = "water";

/**
 * The Water tile: it has no KayKit model, as the 3D World draws each pond as
 * a plane in code, and a hand-made thumbnail. It is an entry in the record
 * of tile numbers like any piece.
 */
const WATER_TILE = {
  image: "kaykit/water.png",
  imagewidth: THUMBNAIL_SIZE,
  imageheight: THUMBNAIL_SIZE,
  properties: [
    { name: "blocks", type: "bool", value: false },
    { name: "kind", type: "string", value: WATER_KIND },
    { name: "piece", type: "string", value: WATER_KIND },
  ],
};

/** Each piece's tile number, by piece name (Water is "water"). */
export type TileNumbers = Record<string, number>;

/**
 * The record of tile numbers, extended: a recorded piece keeps its number, a
 * new one (Water included) takes the next free number, and a recorded piece
 * that is no longer imported keeps its number, unused.
 */
export function numberTiles(
  pieces: PieceSource[],
  record: TileNumbers,
): TileNumbers {
  const numbers = { ...record };
  let next = Math.max(-1, ...Object.values(record)) + 1;
  for (const name of [...pieces.map(pieceName), WATER_KIND])
    if (!(name in numbers)) numbers[name] = next++;
  return numbers;
}

/** `numbers` as the text of `tile-numbers.json`, in the formatter's style. */
export function tileNumbersJson(numbers: TileNumbers): string {
  return `${JSON.stringify(numbers, null, 2)}\n`;
}

/**
 * The KayKit tileset as Tiled's `.tsj`: a collection of images, one tile per
 * piece and one for Water, each with the properties `piece`, `blocks` and
 * `kind`. The tiles are numbered by `numbers`, the record as `numberTiles`
 * extended it, so a piece keeps its number forever and Areas never need
 * repainting after an import.
 */
export function tilesetOf(pieces: PieceSource[], numbers: TileNumbers) {
  const tiles = [
    ...pieces.map((source) => ({
      id: numbers[pieceName(source)],
      image: thumbnailOf(source),
      imagewidth: THUMBNAIL_SIZE,
      imageheight: THUMBNAIL_SIZE,
      properties: [
        { name: "blocks", type: "bool", value: source.blocks },
        { name: "kind", type: "string", value: source.kind },
        { name: "piece", type: "string", value: pieceName(source) },
      ],
    })),
    { id: numbers[WATER_KIND], ...WATER_TILE },
  ].sort((a, b) => a.id - b.id);
  return {
    type: "tileset",
    version: "1.10",
    name: "kaykit",
    tilewidth: THUMBNAIL_SIZE,
    tileheight: THUMBNAIL_SIZE,
    tilecount: Math.max(...tiles.map((tile) => tile.id)) + 1,
    columns: 0,
    margin: 0,
    spacing: 0,
    grid: { orientation: "isometric", width: 192, height: 96 },
    tiles,
  };
}
