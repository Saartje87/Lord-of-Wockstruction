import { isMonsterType, type MonsterType } from "../tuning/monsters";
import { QUEST_IDS, type QuestId } from "../tuning/quests";
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
  /**
   * The Act the Area belongs to, from 1. Null when the map doesn't say:
   * every Combat Area must (see `validateAreas`).
   */
  act: number | null;
  /**
   * Where the Area lies on its Act's Main Path, Town 0, the next 1 and so on.
   * Null for an Area off the Main Path, or one the map doesn't place. From the
   * map's `mainPath` property.
   */
  mainPath: number | null;
  /**
   * Whether the Area lies under the open sky, not in a cave or crypt: the
   * 3D World lights it by day. From the map's `outdoors` property.
   */
  outdoors: boolean;
  width: number;
  height: number;
  /** Row-major, `width * height` long; true where there is floor. */
  floor: boolean[];
  /**
   * Row-major, `width * height` long; true where the Hero can stand: floor
   * that nothing blocks.
   */
  walkable: boolean[];
  /**
   * Row-major, `width * height` long: the KayKit piece (its model's name)
   * on each floor cell, or null where there is no floor or the cell's tile
   * isn't a KayKit piece.
   */
  floorPieces: (string | null)[];
  /** The Walls, from the KayKit tileset's `wall` tiles. */
  walls: Placed[];
  /** The Props, from the KayKit tileset's `prop` tiles. */
  props: Placed[];
  /** Entries by name, in tile units. */
  entries: Record<string, Vec>;
  /** Where Monsters stand when the Area is entered. */
  spawns: Spawn[];
  exits: Exit[];
  npcs: Npc[];
  /**
   * Where a Town Portal's Town end stands (tile units), or null in an Area
   * without one: Town's map must have it (see `validateAreas`).
   */
  townPortal: Vec | null;
  /**
   * Where the Area's Waypoint stands (tile units), or null in an Area
   * without one.
   */
  waypoint: Vec | null;
  /**
   * Where the Area's Bone Altars stand (tile units), each in the middle of
   * its tile. A fresh Session places them, unless a Done Quest has put them
   * away.
   */
  boneAltars: Vec[];
  /**
   * The Unique Monsters the Area holds, each placed by hand. Every new
   * Session places them again, whatever Quests are Done.
   */
  uniques: UniqueSpawn[];
  /**
   * Where the Act Boss of the Act this Area belongs to waits, or null when it
   * isn't in this Area. A Unique Monster placed like the others.
   */
  actBoss: UniqueSpawn | null;
};

/** A named Unique Monster of one Monster type, placed at `pos` (tile units). */
export type UniqueSpawn = { name: string; monster: MonsterType; pos: Vec };

/** A KayKit piece standing on a cell (tile units), blocking the way or not. */
export type Placed = { x: number; y: number; piece: string; blocks: boolean };

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

/**
 * A non-hostile character standing at `pos` (tile units) when `stands`
 * holds, or always when it is null.
 */
export type Npc = { name: string; pos: Vec; stands: NpcCondition | null };

/**
 * The Quest condition an NPC stands where it is placed under: while the
 * Quest `quest` is not yet Ready to hand in (`ready` false), or once it is
 * Ready or Done (`ready` true). It is judged on each arrival in the Area.
 */
export type NpcCondition = { quest: QuestId; ready: boolean };

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

/**
 * A row-major grid's value (`floor`, `walkable`, the World's `explored`) at a
 * point in tile units; false outside the Area.
 */
export function cellAt(
  area: Pick<Area, "width" | "height">,
  grid: readonly boolean[],
  point: Vec,
): boolean {
  const { x, y } = tileOf(point);
  if (x < 0 || y < 0 || x >= area.width || y >= area.height) return false;
  return grid[y * area.width + x];
}

/**
 * Reads the `floor`, `walls & props` and `blocking override` tile layers and
 * the `entry`, `exit`, `monsterSpawn`, `npc`, `townPortal`, `waypoint` and `boneAltar` objects of a
 * Tiled `.tmj` file. An `exit` is a rectangle, or a point for the one tile it
 * is in. Only uncompressed tile data and a single tileset are supported. A
 * tileset in its own file is looked up in `tilesets` by its file name without
 * extension (`../tilesets/grassland.tsj` is `grassland`).
 *
 * A tile on `walls & props` blocks when its tileset tile has `blocks` set. A
 * tile on `blocking override` replaces that with its own `blocks`: set for an
 * invisible wall, unset or false to unblock.
 *
 * An Area painted with the KayKit tileset (tiles with `piece` and `kind`)
 * gets its `floorPieces`, `walls` and `props` from it.
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
  const pieces = piecesOf(tileset);
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
  let townPortal: Vec | null = null;
  let waypoint: Vec | null = null;
  const boneAltars: Vec[] = [];
  const uniques: UniqueSpawn[] = [];
  let actBoss: UniqueSpawn | null = null;
  for (const layer of tmj.layers) {
    if (layer.type !== "objectgroup") continue;
    for (const object of layer.objects) {
      const pos = { x: object.x / unitX, y: object.y / unitY };
      const kind = object.type ?? object.class;
      if (kind === "entry") entries[object.name] = pos;
      if (kind === "monsterSpawn") spawns.push(readSpawn(name, object, pos));
      if (kind === "uniqueMonster") uniques.push(readUnique(name, object, pos));
      if (kind === "actBoss") {
        if (actBoss) throw new Error(`Area "${name}" has two Act Boss spawns`);
        actBoss = readUnique(name, object, pos);
      }
      if (kind === "exit") {
        const size = {
          width: (object.width ?? 0) / unitX,
          height: (object.height ?? 0) / unitY,
        };
        exits.push(readExit(name, object, pos, size));
      }
      if (kind === "npc") {
        npcs.push({ name: object.name, pos, stands: readStands(name, object) });
      }
      if (kind === "townPortal") townPortal = pos;
      if (kind === "boneAltar") boneAltars.push(pos);
      if (kind === "waypoint") {
        if (waypoint) throw new Error(`Area "${name}" has two Waypoints`);
        waypoint = pos;
      }
    }
  }

  const floorPieces = floorLayer.data.map((value) => {
    const gid = value & GID_MASK;
    return gid === 0 ? null : (pieces.get(gid)?.piece ?? null);
  });
  const wallPieces: Placed[] = [];
  const props: Placed[] = [];
  walls?.forEach((value, i) => {
    const piece = pieces.get(value & GID_MASK);
    if (!piece || piece.kind === "floor") return;
    const placed = {
      x: i % tmj.width,
      y: Math.floor(i / tmj.width),
      piece: piece.piece,
      blocks: piece.blocks,
    };
    (piece.kind === "wall" ? wallPieces : props).push(placed);
  });
  return {
    name,
    areaLevel: readAreaLevel(name, tmj),
    act: readAct(name, tmj),
    mainPath: readMainPath(name, tmj),
    outdoors:
      tmj.properties?.find((p) => p.name === "outdoors")?.value === true,
    width: tmj.width,
    height: tmj.height,
    floor,
    floorPieces,
    walls: wallPieces,
    props,
    walkable,
    entries,
    spawns,
    exits,
    npcs,
    townPortal,
    waypoint,
    boneAltars,
    uniques,
    actBoss,
  };
}

/**
 * The Quest condition an `npc` object names with its `quest` and
 * `questReady` properties, or null when it names none.
 */
function readStands(area: string, object: TmjObject): NpcCondition | null {
  const quest = propertyOf(object, "quest");
  if (quest === undefined) return null;
  const ready = propertyOf(object, "questReady");
  if (!(QUEST_IDS as readonly unknown[]).includes(quest)) {
    throw new Error(
      `Area "${area}" has NPC "${object.name}" standing under unknown Quest "${quest}"`,
    );
  }
  if (typeof ready !== "boolean") {
    throw new Error(
      `Area "${area}" has NPC "${object.name}" with a Quest but no "questReady" property`,
    );
  }
  return { quest: quest as QuestId, ready };
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

/** The map's `act` property: a whole number from 1, or null when it has none. */
function readAct(name: string, tmj: Tmj): number | null {
  const act = tmj.properties?.find((p) => p.name === "act")?.value;
  if (act === undefined) return null;
  if (typeof act !== "number" || !Number.isInteger(act) || act < 1) {
    throw new Error(`Area "${name}" has a bad Act: ${act}`);
  }
  return act;
}

/** The map's `mainPath` property: a whole number from 0, or null when it has none. */
function readMainPath(name: string, tmj: Tmj): number | null {
  const position = tmj.properties?.find((p) => p.name === "mainPath")?.value;
  if (position === undefined) return null;
  if (
    typeof position !== "number" ||
    !Number.isInteger(position) ||
    position < 0
  ) {
    throw new Error(`Area "${name}" has a bad Main Path position: ${position}`);
  }
  return position;
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

/** A `uniqueMonster` or `actBoss` object's name and `monster` property. */
function readUnique(name: string, object: TmjObject, pos: Vec): UniqueSpawn {
  const monster = propertyOf(object, "monster");
  if (!isMonsterType(monster)) {
    throw new Error(
      `Area "${name}" has a Unique Monster of unknown type "${monster}"`,
    );
  }
  if (!object.name) {
    throw new Error(`Area "${name}" has a Unique Monster without a name`);
  }
  return { name: object.name, monster, pos };
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

/** A KayKit tileset tile: which model, what it is, and whether it blocks. */
type PieceTile = { piece: string; kind: string; blocks: boolean };

/**
 * The KayKit pieces of a tileset by gid: tiles with a `piece` property.
 * Empty for a tileset that has none.
 */
function piecesOf(tileset: Tileset | null): Map<number, PieceTile> {
  const pieces = new Map<number, PieceTile>();
  if (!tileset) return pieces;
  for (const tile of tileset.tiles ?? []) {
    const value = (key: string) =>
      tile.properties?.find((p) => p.name === key)?.value;
    const piece = value("piece");
    if (typeof piece !== "string") continue;
    pieces.set(tileset.firstgid + tile.id, {
      piece,
      kind: String(value("kind")),
      blocks: value("blocks") === true,
    });
  }
  return pieces;
}
