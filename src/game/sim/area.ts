import { isMonsterType, type MonsterType } from "../tuning/monsters";
import { tileOf, type Vec } from "./vec";

/**
 * Our own definition of an Area. The simulation and the renderer read only
 * this, never the `.tmj` file it was loaded from.
 */
export type Area = {
  name: string;
  width: number;
  height: number;
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
};

/** `count` Monsters of one type, placed around `pos` (tile units). */
export type Spawn = { monster: MonsterType; count: number; pos: Vec };

type TmjLayer =
  | { type: "tilelayer"; name: string; data: number[] }
  | { type: "objectgroup"; name: string; objects: TmjObject[] };

type TmjTileset = {
  firstgid: number;
  /** Set when the tileset is in its own file rather than embedded. */
  source?: string;
  tiles?: {
    id: number;
    properties?: { name: string; value: unknown }[];
  }[];
};

type TmjObject = {
  name: string;
  type?: string;
  class?: string;
  x: number;
  y: number;
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
};

// The top bits of a gid flag flips and rotations, not the tile.
const GID_MASK = 0x0fffffff;

/** Whether there is floor at a point in tile units. */
export function isFloor(area: Area, point: Vec): boolean {
  return cellAt(area, area.floor, point);
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
 * the `entry` and `monsterSpawn` objects of a Tiled `.tmj` file. Only
 * uncompressed tile data and embedded tilesets are supported.
 *
 * A tile on `walls & props` blocks when its tileset tile has `blocks` set. A
 * tile on `blocking override` replaces that with its own `blocks`: set for an
 * invisible wall, unset or false to unblock.
 */
export function loadArea(name: string, content: unknown): Area {
  const tmj = content as Tmj;
  const floorLayer = tmj.layers.find(
    (layer) => layer.type === "tilelayer" && layer.name === "floor",
  );
  if (floorLayer?.type !== "tilelayer") {
    throw new Error(`Area "${name}" has no "floor" tile layer`);
  }
  const blocks = blockingGids(name, tmj.tilesets ?? []);
  const tilesOf = (layerName: string) => {
    const layer = tmj.layers.find(
      (layer) => layer.type === "tilelayer" && layer.name === layerName,
    );
    return layer?.type === "tilelayer" ? layer.data : null;
  };
  const walls = tilesOf("walls & props");
  const overrides = tilesOf("blocking override");
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
  for (const layer of tmj.layers) {
    if (layer.type !== "objectgroup") continue;
    for (const object of layer.objects) {
      const pos = { x: object.x / unitX, y: object.y / unitY };
      const kind = object.type ?? object.class;
      if (kind === "entry") entries[object.name] = pos;
      if (kind === "monsterSpawn") spawns.push(readSpawn(name, object, pos));
    }
  }

  return {
    name,
    width: tmj.width,
    height: tmj.height,
    floor,
    walkable,
    entries,
    spawns,
  };
}

/** A `monsterSpawn` object's `monster` and `count` properties. */
function readSpawn(name: string, object: TmjObject, pos: Vec): Spawn {
  const property = (key: string) =>
    object.properties?.find((p) => p.name === key)?.value;
  const monster = property("monster");
  if (!isMonsterType(monster)) {
    throw new Error(`Area "${name}" spawns unknown monster "${monster}"`);
  }
  const count = property("count") ?? 1;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
    throw new Error(
      `Area "${name}" spawns a bad count of ${monster}: ${count}`,
    );
  }
  return { monster, count, pos };
}

/** The gids of every tileset tile whose `blocks` property is set. */
function blockingGids(name: string, tilesets: TmjTileset[]): Set<number> {
  const gids = new Set<number>();
  for (const tileset of tilesets) {
    if (tileset.source) {
      throw new Error(
        `Area "${name}" uses external tileset "${tileset.source}"; embed it`,
      );
    }
    for (const tile of tileset.tiles ?? []) {
      const property = tile.properties?.find((p) => p.name === "blocks");
      if (property?.value === true) gids.add(tileset.firstgid + tile.id);
    }
  }
  return gids;
}
