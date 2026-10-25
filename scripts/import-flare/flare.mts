import { readFileSync } from "node:fs";
import type { Rect } from "./image.mts";

/**
 * Flare's direction numbers as screen compass points. Flare counts from
 * screen west, clockwise (`Utils::calcDirection` in flare-engine). Nothing
 * outside this script should ever see the numbers.
 */
export const COMPASS = ["w", "nw", "n", "ne", "e", "se", "s", "sw"] as const;
export type Compass = (typeof COMPASS)[number];

/** One frame of a Flare animation: where it is in the atlas, and its anchor. */
export type FlareFrame = Rect & { ox: number; oy: number };

export type FlareAnimation = {
  frames: number;
  durationMs: number;
  type: "looped" | "play_once" | "back_forth";
  /** `[frame][direction]` */
  rects: FlareFrame[][];
};

/** Reads an INI-like Flare file into its `[section]`s of `key=value` lines. */
function readSections(path: string) {
  const sections: { name: string; lines: [string, string][] }[] = [];
  let current = { name: "", lines: [] as [string, string][] };
  sections.push(current);
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const header = line.match(/^\[(.+)\]$/);
    if (header) {
      current = { name: header[1], lines: [] };
      sections.push(current);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) throw new Error(`${path}: can't read "${line}"`);
    current.lines.push([line.slice(0, eq), line.slice(eq + 1)]);
  }
  return sections;
}

const ints = (s: string) => s.split(",").map(Number);

/** Reads a Flare animation definition (`animations/**.txt`). */
export function readAnimations(path: string) {
  const sections = readSections(path);
  const image = sections[0].lines.find(([k]) => k === "image")?.[1];
  if (!image) throw new Error(`${path}: no image`);

  const animations = new Map<string, FlareAnimation>();
  for (const { name, lines } of sections.slice(1)) {
    const get = (key: string) => lines.find(([k]) => k === key)?.[1] ?? "";
    const frames = Number(get("frames"));
    const rects: FlareFrame[][] = Array.from({ length: frames }, () => []);
    for (const [key, value] of lines) {
      if (key !== "frame") continue;
      const [index, dir, x, y, w, h, ox, oy] = ints(value);
      rects[index][dir] = { x, y, w, h, ox, oy };
    }
    animations.set(name, {
      frames,
      durationMs: Number.parseInt(get("duration"), 10),
      type: animationType(path, get("type")),
      rects,
    });
  }
  return { image, animations };
}

function animationType(path: string, type: string): FlareAnimation["type"] {
  if (type === "looped" || type === "play_once" || type === "back_forth")
    return type;
  throw new Error(`${path}: unknown animation type "${type}"`);
}

export type FlareTile = FlareFrame & { id: number };

/** Reads a Flare tileset definition: one atlas image per `[tileset]`. */
export function readTileset(path: string) {
  return readSections(path)
    .filter((s) => s.name === "tileset")
    .map(({ lines }) => ({
      image: lines.find(([k]) => k === "img")?.[1] ?? "",
      tiles: lines
        .filter(([k]) => k === "tile")
        .map(([, v]): FlareTile => {
          const [id, x, y, w, h, ox, oy] = ints(v);
          return { id, x, y, w, h, ox, oy };
        }),
    }));
}

/**
 * Reads `engine/hero_layers.txt`: per direction, the equipment slots in
 * draw order, back to front.
 */
export function readHeroLayers(path: string): Map<Compass, string[]> {
  // Flare names directions in map space, a 45° turn from the screen.
  const flareName: Record<string, number> = {
    SW: 0,
    W: 1,
    NW: 2,
    N: 3,
    NE: 4,
    E: 5,
    SE: 6,
    S: 7,
  };
  const order = new Map<Compass, string[]>();
  for (const [key, value] of readSections(path)[0].lines) {
    if (key !== "layer") continue;
    const [dir, ...slots] = value.split(",");
    if (!(dir in flareName))
      throw new Error(`${path}: unknown direction ${dir}`);
    order.set(COMPASS[flareName[dir]], slots);
  }
  return order;
}
