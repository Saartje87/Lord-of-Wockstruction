/**
 * The one-time conversion of the four Areas from Flare's tilesets to the
 * KayKit tileset, cell by cell: `content/areas/flare/<area>.tmj` becomes
 * `content/areas/<area>.tmj`. Every cell keeps its floor, and whatever stopped
 * the Hero still does, so walkable cells, Exits, Entries, spawns and the Town
 * Portal spot stay as they were (`content.test.ts` checks). Which piece a
 * cell gets is a rough choice from the Flare tile it had; the maps are
 * refined by hand in Tiled after this.
 *
 * Run it with `node scripts/convert-areas-kaykit.mts`. It is kept for the
 * record: rerunning it overwrites any hand-made changes to the maps.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PIECES, pieceName } from "./import-kaykit/pieces.mts";

type Layer = { name: string; type: string; data?: number[] } & Record<
  string,
  unknown
>;
type Tile = { id: number; properties?: { name: string; value: unknown }[] };

const GID_MASK = 0x0fffffff;

/** The tile id (and gid, as the tileset is the map's first) of a piece. */
const gidOf = (piece: string) => {
  const id = PIECES.findIndex((source) => pieceName(source) === piece);
  if (id === -1) throw new Error(`No piece ${piece} in the KayKit tileset`);
  return id + 1;
};

/** A steady 0..1 for a cell and a salt, so a rerun gives the same maps. */
function hash(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** One of `options`, by a cell's hash. */
const pick = <T,>(options: T[], x: number, y: number, salt: number): T =>
  options[Math.floor(hash(x, y, salt) * options.length)];

/** What a Flare tileset's cells turn into. */
type Style = {
  floor: (id: number, x: number, y: number) => string;
  /** The Wall on a cell with no floor. */
  wall: string;
  /** The Prop on a floor cell that something blocked. */
  blocking: (x: number, y: number) => string;
  /** The Prop on a floor cell that nothing blocked. */
  open: (x: number, y: number) => string;
};

const DUNGEON: Style = {
  // Flare's ids 16-19 are the plain floor; the rest are worn and bare.
  floor: (id, x, y) =>
    id < 20
      ? "dungeon/floor_tile_large"
      : hash(x, y, 1) < 0.5
        ? "dungeon/floor_tile_small_broken_A"
        : "dungeon/floor_dirt_large",
  wall: "dungeon/wall",
  blocking: (x, y) =>
    pick(
      [
        "dungeon/pillar",
        "dungeon/column",
        "dungeon/barrel_large",
        "dungeon/crates_stacked",
        "dungeon/crates_stacked",
        "dungeon/chest",
      ],
      x,
      y,
      2,
    ),
  open: (x, y) =>
    pick(["dungeon/candle_triple", "dungeon/rubble_half"], x, y, 3),
};

const TOWN: Style = {
  // Flare's ids 16-32 are plain grass, the rest are paths and patches.
  floor: (id, x, y) =>
    id < 33
      ? "halloween/floor_dirt"
      : pick(
          [
            "halloween/path_A",
            "halloween/path_B",
            "halloween/path_C",
            "halloween/path_D",
          ],
          x,
          y,
          1,
        ),
  wall: "halloween/fence",
  blocking: (x, y) => {
    const chance = hash(x, y, 2);
    if (chance < 0.12) {
      return pick(
        [
          "hexagon/building_home_A_red",
          "hexagon/building_home_B_blue",
          "hexagon/building_tavern_red",
          "hexagon/building_church_blue",
          "hexagon/building_well_red",
          "hexagon/building_blacksmith_red",
        ],
        x,
        y,
        3,
      );
    }
    if (chance < 0.14) return "halloween/crypt";
    if (chance < 0.17) return "halloween/shrine";
    return pick(
      [
        "halloween/tree_dead_large",
        "halloween/tree_dead_medium",
        "halloween/gravestone",
        "halloween/grave_A",
      ],
      x,
      y,
      4,
    );
  },
  open: (x, y) =>
    pick(
      [
        "halloween/lantern_standing",
        "halloween/gravemarker_A",
        "halloween/skull",
        "halloween/bone_A",
        "halloween/pumpkin_orange_small",
      ],
      x,
      y,
      5,
    ),
};

const AREAS = [
  { name: "town", tileset: "grassland", style: TOWN },
  { name: "catacombs", tileset: "dungeon", style: DUNGEON },
  { name: "crypt", tileset: "dungeon", style: DUNGEON },
  { name: "ossuary", tileset: "dungeon", style: DUNGEON },
];

for (const { name, tileset, style } of AREAS) {
  const map = JSON.parse(
    readFileSync(`content/areas/flare/${name}.tmj`, "utf8"),
  );
  const flare = JSON.parse(
    readFileSync(`content/tilesets/${tileset}.tsj`, "utf8"),
  ) as { tiles: Tile[] };
  const blocks = new Set(
    flare.tiles
      .filter((tile) =>
        tile.properties?.some((p) => p.name === "blocks" && p.value === true),
      )
      .map((tile) => tile.id + 1),
  );
  const layers = map.layers as Layer[];
  const dataOf = (layer: string) =>
    layers.find((l) => l.name === layer)?.data ?? [];
  const floorData = dataOf("floor");
  const propData = dataOf("walls & props");
  const overrideData = dataOf("blocking override");

  const floor = floorData.map((value, i) => {
    const gid = value & GID_MASK;
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    return gid === 0 ? 0 : gidOf(style.floor(gid - 1, x, y));
  });
  const props = propData.map((value, i) => {
    const gid = value & GID_MASK;
    const override = (overrideData[i] ?? 0) & GID_MASK;
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    if (override === 0 && gid === 0) return 0;
    const blocked = override ? blocks.has(override) : blocks.has(gid);
    if (floor[i] === 0) {
      // Without floor, a Wall; what the Flare cell drew there is gone.
      return override || gid ? gidOf(style.wall) : 0;
    }
    if (blocked) return gidOf(style.blocking(x, y));
    return gid === 0 ? 0 : gidOf(style.open(x, y));
  });

  const converted = {
    ...map,
    tilesets: [{ firstgid: 1, source: "../tilesets/kaykit.tsj" }],
    layers: layers
      .filter((layer) => layer.name !== "blocking override")
      .map((layer) =>
        layer.name === "floor"
          ? { ...layer, data: floor }
          : layer.name === "walls & props"
            ? { ...layer, data: props }
            : layer,
      ),
  };
  writeFileSync(
    `content/areas/${name}.tmj`,
    `${JSON.stringify(converted, null, 1)}\n`,
  );
  console.log(`Wrote content/areas/${name}.tmj`);
}
