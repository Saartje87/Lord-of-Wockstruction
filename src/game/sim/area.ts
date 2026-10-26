import { isMonsterType, type MonsterType } from "../tuning/monsters";
import { tileOf, type Vec } from "./vec";

/**
 * Our own definition of an Area. The simulation and the renderer read only
 * this, never the `.tmj` file it was loaded from.
 */
export type Area = {
  name: string;
  /**
   * How hard a Combat Area is: the Monster Level of every Monster in it.
   * Null for Town, which has none.
   */
  areaLevel: number | null;
  width: number;
  height: number;
  /**
   * The tileset the tile ids below come from, by name (`grassland`, …), or
   * null when the Area has none.
   */
  tileset: string | null;
  /**
   * Row-major, `width * height` long: the tileset tile id drawn on the
   * floor, or null where there is none. Ids equal Flare's tile ids.
   */
  floorTiles: (number | null)[];
  /** Like `floorTiles`, for the walls and props drawn among characters. */
  propTiles: (number | null)[];
  /** Row-major, `width * height` long; true where there is floor. */
  floor: boolean[];
  /**
   * Row-major, `width * height` long; true where the Hero can stand: floor
   * that nothing blocks.
   */
  walkable: boolean[];
  /** Entries by name, in tile units. */
  entries: Record<string, Vec>;
  /** Where Monsters stand when the Area is entered. */
  spawns: Spawn[];
  exits: Exit[];
  npcs: Npc[];
};

/** `count` Monsters of one type, placed around `pos` (tile units). */
export type Spawn = { monster: MonsterType; count: number; pos: Vec };

/**
 * A zone, in tile units, that takes the Hero to Entry `entry` in Area `area`
 * when they walk into it.
 */
export type Exit = {
  area: string;
  entry: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** A non-hostile character standing at `pos` (tile units). */
export type Npc = { name: string; pos: Vec };

type TmjLayer =
  | { type: "tilelayer"; name: string; data: number[] }
  | { type: "objectgroup"; name: string; objects: TmjObject[] };

/** A tileset's own content, embedded in a map or in its own `.tsj` file. */
type Tsj = {
  name: string;
  tiles?: {
    id: number;
    properties?: { name: string; value: unknown }[];
  }[];
};

/** The Area's one tileset: its content and the first gid it covers. */
type Tileset = Tsj & { firstgid: number };

type TmjTileset =
  | ({ firstgid: number; source?: undefined } & Tsj)
  /** A tileset in its own file, a path relative to the map. */
  | { firstgid: number; source: string };

type TmjObject = {
  name: string;
  type?: string;
  class?: string;
  x: number;
  y: number;
  /** A rectangle's size, in the same units as `x` and `y`; 0 for a point. */
  width?: number;
  height?: number;
  properties?: { name: string; value: unknown }[];
};

type Tmj = {
  orientation: string;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  tilesets?: TmjTileset[];
  layers: TmjLayer[];
  /** The map's own custom properties, such as `areaLevel`. */
  properties?: { name: string; value: unknown }[];
};

/** The one Area that is Town, by name; every other Area is a Combat Area. */
export const TOWN = "town";

// The top bits of a gid flag flips and rotations, not the tile.
const GID_MASK = 0x0fffffff;

/** Whether there is floor at a point in tile units. */
export function isFloor(area: Area, point: Vec): boolean {
  return cellAt(area, area.floor, point);
}

/** The Exit whose zone holds a point in tile units, if any. */
export function exitAt(area: Area, point: Vec): Exit | undefined {
  return area.exits.find(
    (exit) =>
      point.x >= exit.x &&
      point.x < exit.x + exit.width &&
      point.y >= exit.y &&
      point.y < exit.y + exit.height,
  );
}

/** Whether the Hero can stand at a point in tile units. */
export function isWalkable(area: Area, point: Vec): boolean {
  return cellAt(area, area.walkable, point);
}

/** A row-major grid's value at a point; false outside the Area. */
function cellAt(area: Area, grid: boolean[], point: Vec): boolean {
  const { x, y } = tileOf(point);
  if (x < 0 || y < 0 || x >= area.width || y >= area.height) return false;
  return grid[y * area.width + x];
}

/**
 * Reads the `floor`, `walls & props` and `blocking override` tile layers and
 * the `entry`, `exit`, `monsterSpawn` and `npc` objects of a Tiled `.tmj`
 * file. An `exit` is a rectangle, or a point for the one tile it is in. Only
 * uncompressed tile data and a single tileset are supported. A tileset in its
 * own file is looked up in `tilesets` by its file name without extension
 * (`../tilesets/grassland.tsj` is `grassland`).
 *
 * A tile on `walls & props` blocks when its tileset tile has `blocks` set. A
 * tile on `blocking override` replaces that with its own `blocks`: set for an
 * invisible wall, unset or false to unblock.
 */
export function loadArea(
  name: string,
  content: unknown,
  tilesets: Record<string, unknown> = {},
): Area {
  const tmj = content as Tmj;
  const floorLayer = tmj.layers.find(
    (layer) => layer.type === "tilelayer" && layer.name === "floor",
  );
  if (floorLayer?.type !== "tilelayer") {
    throw new Error(`Area "${name}" has no "floor" tile layer`);
  }
  const tileset = readTileset(name, tmj.tilesets ?? [], tilesets);
  const blocks = blockingGids(tileset);
  const tilesOf = (layerName: string) => {
    const layer = tmj.layers.find(
      (layer) => layer.type === "tilelayer" && layer.name === layerName,
    );
    return layer?.type === "tilelayer" ? layer.data : null;
  };
  const walls = tilesOf("walls & props");
  const overrides = tilesOf("blocking override");
  const firstgid = tileset?.firstgid ?? 1;
  const tileIds = (data: number[] | null) =>
    floorLayer.data.map((_, i) => {
      const gid = (data?.[i] ?? 0) & GID_MASK;
      return gid === 0 ? null : gid - firstgid;
    });
  const floor = floorLayer.data.map((gid) => gid !== 0);
  const walkable = floor.map((hasFloor, i) => {
    const override = (overrides?.[i] ?? 0) & GID_MASK;
    const blocked = override
      ? blocks.has(override)
      : blocks.has((walls?.[i] ?? 0) & GID_MASK);
    return hasFloor && !blocked;
  });

  // Tiled measures objects on isometric maps in tileheight units on both axes.
  const unitX =
    tmj.orientation === "isometric" ? tmj.tileheight : tmj.tilewidth;
  const unitY = tmj.tileheight;
  const entries: Record<string, Vec> = {};
  const spawns: Spawn[] = [];
  const exits: Exit[] = [];
  const npcs: Npc[] = [];
  for (const layer of tmj.layers) {
    if (layer.type !== "objectgroup") continue;
    for (const object of layer.objects) {
      const pos = { x: object.x / unitX, y: object.y / unitY };
      const kind = object.type ?? object.class;
      if (kind === "entry") entries[object.name] = pos;
      if (kind === "monsterSpawn") spawns.push(readSpawn(name, object, pos));
      if (kind === "exit") {
        const size = {
          width: (object.width ?? 0) / unitX,
          height: (object.height ?? 0) / unitY,
        };
        exits.push(readExit(name, object, pos, size));
      }
      if (kind === "npc") npcs.push({ name: object.name, pos });
    }
  }

  return {
    name,
    areaLevel: readAreaLevel(name, tmj),
    width: tmj.width,
    height: tmj.height,
    tileset: tileset?.name ?? null,
    floorTiles: tileIds(floorLayer.data),
    propTiles: tileIds(walls),
    floor,
    walkable,
    entries,
    spawns,
    exits,
    npcs,
  };
}

/** A Tiled object's custom property's value, if it has it. */
function propertyOf(object: TmjObject, key: string): unknown {
  return object.properties?.find((p) => p.name === key)?.value;
}

/**
 * The map's `areaLevel` property: a whole number from 1, or null when it has
 * none. Whether the Area should have one is `validateAreas`'s to check.
 */
function readAreaLevel(name: string, tmj: Tmj): number | null {
  const level = tmj.properties?.find((p) => p.name === "areaLevel")?.value;
  if (level === undefined) return null;
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1) {
    throw new Error(`Area "${name}" has a bad Area Level: ${level}`);
  }
  return level;
}

/** An `exit` object's zone and its `area` and `entry` properties. */
function readExit(
  name: string,
  object: TmjObject,
  pos: Vec,
  size: { width: number; height: number },
): Exit {
  const area = propertyOf(object, "area");
  const entry = propertyOf(object, "entry");
  if (typeof area !== "string" || typeof entry !== "string") {
    throw new Error(`Area "${name}" has an Exit without an area and entry`);
  }
  if (size.width === 0 || size.height === 0) {
    const tile = tileOf(pos);
    return { area, entry, ...tile, width: 1, height: 1 };
  }
  return { area, entry, ...pos, ...size };
}

/** A `monsterSpawn` object's `monster` and `count` properties. */
function readSpawn(name: string, object: TmjObject, pos: Vec): Spawn {
  const monster = propertyOf(object, "monster");
  if (!isMonsterType(monster)) {
    throw new Error(`Area "${name}" spawns unknown monster "${monster}"`);
  }
  const count = propertyOf(object, "count") ?? 1;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
    throw new Error(
      `Area "${name}" spawns a bad count of ${monster}: ${count}`,
    );
  }
  return { monster, count, pos };
}

/** The Area's one tileset, with its content, or null when it has none. */
function readTileset(
  name: string,
  refs: TmjTileset[],
  files: Record<string, unknown>,
): Tileset | null {
  if (refs.length > 1) {
    throw new Error(`Area "${name}" uses ${refs.length} tilesets; use one`);
  }
  const ref = refs[0];
  if (!ref) return null;
  if (ref.source === undefined) return ref;
  const file = ref.source.replace(/^.*\//, "").replace(/\.[^.]*$/, "");
  const content = files[file] as Tsj | undefined;
  if (!content) {
    throw new Error(`Area "${name}" uses unknown tileset "${file}"`);
  }
  return { ...content, name: file, firstgid: ref.firstgid };
}

/** The gids of every tile in a tileset whose `blocks` property is set. */
function blockingGids(tileset: Tileset | null): Set<number> {
  const gids = new Set<number>();
  if (!tileset) return gids;
  for (const tile of tileset.tiles ?? []) {
    const property = tile.properties?.find((p) => p.name === "blocks");
    if (property?.value === true) gids.add(tileset.firstgid + tile.id);
  }
  return gids;
}
