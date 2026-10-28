import { toScreen } from "../iso";
import type { Area } from "../sim/area";
import { tileOf, type Vec } from "../sim/vec";
import type { Viewport } from "../viewport";

/**
 * How the Map Overlay is drawn (CSS px, whatever the UI Scale): `scale` is
 * how much of the World's size a tile takes, and `opacity` how much of it
 * shows through. The marks' sizes are fixed pixels, never scaled with the map.
 */
export const MAP_OVERLAY = { scale: 0.25, opacity: 0.55 };

/** The look of the maps' lines and marks. */
export const MAP_LOOK = {
  /** Where walkable floor meets a wall. */
  wall: { colour: 0xd8d0b4, width: 2 },
  /** Where walkable floor meets void. */
  floor: { colour: 0x7d8a94, width: 1 },
  /** The Hero's white cross, `size` across. */
  hero: { colour: 0xffffff, size: 7, width: 1.5 },
  /** A Minion's dot, `radius` wide. */
  minion: { colour: 0x6fe06f, radius: 2.5 },
  /** An Exit's flat diamond, `width` by `height`, and its name above it. */
  exit: {
    colour: 0xe8c45a,
    width: 12,
    height: 6,
    nameColour: 0xe8c45a,
    nameSize: 11,
    nameGap: 3,
  },
  /** The Town Portal's ring, `width` by `height`, round a centre dot. */
  townPortal: { colour: 0x6ab4ff, width: 14, height: 8, dot: 1.5 },
  /** An NPC's name, in bold. */
  npc: { nameColour: 0xd4a84a, nameSize: 11 },
  /** The Area's display name at the top right of the Map Overlay. */
  areaName: { colour: 0xe8c45a, size: 24, margin: 16 },
};

/** One edge of a walkable tile, in tile units, with what is on its far side. */
export type MapEdge = { from: Vec; to: Vec; kind: "wall" | "floor" };

/**
 * What the maps draw, in tile units: shared by the Map Overlay and the Mini
 * Map, which only differ in where and how big they draw it.
 */
export type MapMarks = {
  /** The Area's wall and floor edges. */
  edges: MapEdge[];
  /** Where the Hero stands. */
  hero: Vec;
  /** Where the Hero's Minions stand. */
  minions: Vec[];
  /** Explored Exits at their middle, named after the Area each leads to. */
  exits: { at: Vec; name: string }[];
  /** The Town Portal's end here, when its tile is Explored. */
  townPortal: Vec | null;
  /** Explored NPCs, by name. */
  npcs: { at: Vec; name: string }[];
};

/** What `mapMarks` is made from. */
export type MapMarksOf = {
  area: Area;
  explored: boolean[];
  heroAt: Vec;
  /** Where the Hero's Minions stand. */
  minions: Vec[];
  /** The Town Portal's end in `area`, if it has one. */
  townPortal: Vec | null;
  /** Area display names by Area name, to name the Exits. */
  displayNames: Readonly<Record<string, string>>;
};

/**
 * The marks of `area` for a Hero standing at `heroAt`: a wall edge on each
 * side of a walkable tile that meets a wall, a floor edge on each that meets
 * void or the Area's end; only of tiles that are Explored. Exits, the Town
 * Portal and NPCs are marked only where Explored too; the Hero and the
 * Minions always. Never Monsters, Corpses, Ground Items or Projectiles.
 */
export function mapMarks(of: MapMarksOf): MapMarks {
  const { area, explored, heroAt } = of;
  const { width, height } = area;
  const at = (cells: boolean[], x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && cells[y * width + x];
  const edges: MapEdge[] = [];
  // Each side of a tile: its two corners, and the neighbour across it.
  const sides = [
    { from: [0, 0], to: [1, 0], across: [0, -1] },
    { from: [1, 0], to: [1, 1], across: [1, 0] },
    { from: [1, 1], to: [0, 1], across: [0, 1] },
    { from: [0, 1], to: [0, 0], across: [-1, 0] },
  ];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!at(area.walkable, x, y) || !explored[y * width + x]) continue;
      for (const side of sides) {
        const [ax, ay] = [x + side.across[0], y + side.across[1]];
        if (at(area.walkable, ax, ay)) continue;
        edges.push({
          from: { x: x + side.from[0], y: y + side.from[1] },
          to: { x: x + side.to[0], y: y + side.to[1] },
          kind: at(area.floor, ax, ay) ? "wall" : "floor",
        });
      }
    }
  }
  const seen = (at: Vec) => {
    const tile = tileOf(at);
    return at.x >= 0 && at.y >= 0 && at.x < width && at.y < height
      ? explored[tile.y * width + tile.x]
      : false;
  };
  return {
    edges,
    hero: { ...heroAt },
    minions: of.minions.map((at) => ({ ...at })),
    exits: area.exits
      .map((exit) => ({
        at: { x: exit.x + exit.width / 2, y: exit.y + exit.height / 2 },
        name: of.displayNames[exit.area],
      }))
      .filter(({ at }) => seen(at)),
    townPortal:
      of.townPortal && seen(of.townPortal) ? { ...of.townPortal } : null,
    npcs: area.npcs
      .filter((npc) => seen(npc.pos))
      .map((npc) => ({ at: { ...npc.pos }, name: npc.name })),
  };
}

/**
 * Where the Map Overlay's Area name is drawn: its top right corner, and how
 * big the text is, at the UI Scale.
 */
export function mapAreaNameLayout(screen: Viewport): { at: Vec; size: number } {
  const { margin, size } = MAP_LOOK.areaName;
  return {
    at: {
      x: screen.width - margin * screen.uiScale,
      y: margin * screen.uiScale,
    },
    size: size * screen.uiScale,
  };
}

/**
 * Where a point of the Area (tile units) lies from the centre of a map
 * centred on `heroAt`, in screen px: the World's isometric angle, at `scale`.
 */
export function mapOffset(tile: Vec, heroAt: Vec, scale: number): Vec {
  const at = toScreen({ x: tile.x - heroAt.x, y: tile.y - heroAt.y });
  return { x: at.x * scale, y: at.y * scale };
}
