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
  /** Entries by name, in tile units. */
  entries: Record<string, Vec>;
};

type TmjLayer =
  | { type: "tilelayer"; name: string; data: number[] }
  | { type: "objectgroup"; name: string; objects: TmjObject[] };

type TmjObject = {
  name: string;
  type?: string;
  class?: string;
  x: number;
  y: number;
};

type Tmj = {
  orientation: string;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TmjLayer[];
};

/** Whether there is floor at a point in tile units. */
export function isFloor(area: Area, point: Vec): boolean {
  const { x, y } = tileOf(point);
  if (x < 0 || y < 0 || x >= area.width || y >= area.height) return false;
  return area.floor[y * area.width + x];
}

/**
 * Reads the `floor` tile layer and the `entry` objects of a Tiled `.tmj` file.
 * Only uncompressed tile data is supported.
 */
export function loadArea(name: string, content: unknown): Area {
  const tmj = content as Tmj;
  const floorLayer = tmj.layers.find(
    (layer) => layer.type === "tilelayer" && layer.name === "floor",
  );
  if (floorLayer?.type !== "tilelayer") {
    throw new Error(`Area "${name}" has no "floor" tile layer`);
  }

  // Tiled measures objects on isometric maps in tileheight units on both axes.
  const unitX =
    tmj.orientation === "isometric" ? tmj.tileheight : tmj.tilewidth;
  const unitY = tmj.tileheight;
  const entries: Record<string, Vec> = {};
  for (const layer of tmj.layers) {
    if (layer.type !== "objectgroup") continue;
    for (const object of layer.objects) {
      if ((object.type ?? object.class) !== "entry") continue;
      entries[object.name] = { x: object.x / unitX, y: object.y / unitY };
    }
  }

  return {
    name,
    width: tmj.width,
    height: tmj.height,
    floor: floorLayer.data.map((gid) => gid !== 0),
    entries,
  };
}
