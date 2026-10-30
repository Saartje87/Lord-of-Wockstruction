import { toScreen } from "../iso";
import { type Area, cellAt } from "../sim/area";
import type { Vec } from "../sim/vec";
import type { Viewport } from "../viewport";
import { topRightEdge } from "./panelButtons";

/**
 * How the Map Overlay is drawn: `scale` is how much of the World's size a
 * tile takes (at any World zoom), and `opacity` how much of it shows through.
 */
export const MAP_OVERLAY = { scale: 0.25, opacity: 0.55 };

/**
 * The look of the maps' lines and marks (CSS px at native scale, drawn at the
 * UI Scale, never scaled with the map).
 */
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
  /** The Waypoint's ring, `width` by `height`, round a centre diamond. */
  waypoint: { colour: 0xb48cff, width: 14, height: 8, diamond: 2.5 },
  /** A Bone Altar's red square, `size` across. */
  boneAltar: { colour: 0xe2573d, size: 6 },
  /** An NPC's name, in bold. */
  npc: { nameColour: 0xd4a84a, nameSize: 11 },
  /** The Area's display name at the top right of the Map Overlay. */
  areaName: { colour: 0xe8c45a, size: 24, margin: 16 },
};

/** One edge of a walkable tile, in tile units, with what is on its far side. */
export type MapEdge = { from: Vec; to: Vec; kind: "wall" | "floor" };

/**
 * What the maps draw, in tile units: shared by the Map Overlay and the Mini
 * Map, which only differ in where and how big they draw it. The Hero's own
 * mark is always at the middle of the map, so it is not here.
 */
export type MapMarks = {
  /** The Area's wall and floor edges. */
  edges: MapEdge[];
  /** Where the Hero's Minions stand. */
  minions: Vec[];
  /** Explored Exits at their middle, named after the Area each leads to. */
  exits: { at: Vec; name: string }[];
  /** The Town Portal's end here, when its tile is Explored. */
  townPortal: Vec | null;
  /** Explored NPCs, by name. */
  npcs: { at: Vec; name: string }[];
  /** The Area's Waypoint, when its tile is Explored. */
  waypoint: Vec | null;
  /** The Bone Altars still standing on Explored tiles. */
  boneAltars: Vec[];
};

/**
 * What the maps are made from, once a frame: both the Map Overlay and the
 * Mini Map draw from the same one.
 */
export type MapInputs = {
  area: Area;
  /** Which tiles of `area` are Explored, row by row. */
  explored: readonly boolean[];
  /** Where the Hero stands, which the maps centre on. */
  heroAt: Vec;
  /** Where the Hero's Minions stand. */
  minions: Vec[];
  /** The Town Portal's end in `area`, if it has one. */
  townPortal: Vec | null;
  /** The NPCs standing in `area` now. */
  npcs: readonly { name: string; pos: Vec }[];
  /** Where the Bone Altars still standing in `area` are. */
  boneAltars: readonly Vec[];
  /** Area display names by Area name, to name the Exits. */
  displayNames: Readonly<Record<string, string>>;
};

/**
 * The marks of `area`: a wall edge on each side of a walkable tile that
 * meets a wall, a floor edge on each that meets void or the Area's end; only
 * of tiles that are Explored. Exits, the Town Portal, the Waypoint and NPCs are marked
 * only where Explored too; the Minions always. Never Monsters, Corpses,
 * Ground Items or Projectiles.
 */
export function mapMarks(inputs: MapInputs): MapMarks {
  const { area, explored } = inputs;
  const edges: MapEdge[] = [];
  // Each side of a tile: its two corners, and the neighbour across it.
  const sides = [
    { from: [0, 0], to: [1, 0], across: [0, -1] },
    { from: [1, 0], to: [1, 1], across: [1, 0] },
    { from: [1, 1], to: [0, 1], across: [0, 1] },
    { from: [0, 1], to: [0, 0], across: [-1, 0] },
  ];
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      const tile = { x, y };
      if (!cellAt(area, area.walkable, tile) || !cellAt(area, explored, tile)) {
        continue;
      }
      for (const side of sides) {
        const across = { x: x + side.across[0], y: y + side.across[1] };
        if (cellAt(area, area.walkable, across)) continue;
        edges.push({
          from: { x: x + side.from[0], y: y + side.from[1] },
          to: { x: x + side.to[0], y: y + side.to[1] },
          kind: cellAt(area, area.floor, across) ? "wall" : "floor",
        });
      }
    }
  }
  const isExplored = (point: Vec) => cellAt(area, explored, point);
  return {
    edges,
    minions: inputs.minions.map((minion) => ({ ...minion })),
    exits: area.exits
      .map((exit) => ({
        at: { x: exit.x + exit.width / 2, y: exit.y + exit.height / 2 },
        name: inputs.displayNames[exit.area],
      }))
      .filter((exit) => isExplored(exit.at)),
    townPortal:
      inputs.townPortal && isExplored(inputs.townPortal)
        ? { ...inputs.townPortal }
        : null,
    npcs: inputs.npcs
      .filter((npc) => isExplored(npc.pos))
      .map((npc) => ({ at: { ...npc.pos }, name: npc.name })),
    waypoint:
      area.waypoint && isExplored(area.waypoint) ? { ...area.waypoint } : null,
    boneAltars: inputs.boneAltars
      .filter((altar) => isExplored(altar))
      .map((altar) => ({ ...altar })),
  };
}

/**
 * Where the Map Overlay's Area name is drawn: its top right corner, left of
 * the Panel buttons' column in the Compact Layout, and how big the text is,
 * at the UI Scale.
 */
export function mapAreaNameLayout(screen: Viewport): { at: Vec; size: number } {
  const { margin, size } = MAP_LOOK.areaName;
  return {
    at: {
      x: topRightEdge(screen) - margin * screen.uiScale,
      y: margin * screen.uiScale,
    },
    size: size * screen.uiScale,
  };
}

/**
 * How much of the World's size a tile takes on the Map Overlay: the World is
 * drawn at the World zoom, so the overlay follows it.
 */
export function mapOverlayScale(screen: Viewport): number {
  return MAP_OVERLAY.scale * screen.worldZoom;
}

/**
 * Where a point of the Area (tile units) lies from the centre of a map
 * centred on `heroAt`, in screen px: the World's isometric angle, at `scale`.
 */
export function mapOffset(tile: Vec, heroAt: Vec, scale: number): Vec {
  const at = toScreen({ x: tile.x - heroAt.x, y: tile.y - heroAt.y });
  return { x: at.x * scale, y: at.y * scale };
}
