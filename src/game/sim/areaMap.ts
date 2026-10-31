import { type MonsterType, monsterTuning } from "../tuning/monsters";
import type { Area } from "./area";
import { tileOf, type Vec } from "./vec";

/**
 * One kind of thing the map marks, drawn as `char` on each of `tiles`.
 * `lines` describe each one in the legend.
 */
type Marker = { char: string; tiles: Vec[]; lines: string[] };

/** What each terrain character means, in the order the legend lists them. */
const TERRAIN: Record<string, string> = {
  " ": "void: no floor (a blank)",
  ".": "floor",
  "~": "Water",
  "#": "a blocking Wall",
  "%": "a blocking Prop",
  "!": "blocked floor with no piece on it: an invisible wall",
};

/**
 * An Area drawn as text, one character a tile: a title, the tile grid with
 * column numbers along the top and row numbers down the side, and a legend.
 * Printed by `npm run area:map <area>`.
 */
export function areaMap(area: Area): string {
  const cells = terrainOf(area);
  const terrainUsed = new Set(cells);
  const markers = markersOf(area);
  // Drawn last first, so the marker first in the legend wins a shared tile.
  for (const marker of [...markers].reverse()) {
    for (const { x, y } of marker.tiles) {
      if (x >= 0 && y >= 0 && x < area.width && y < area.height) {
        cells[y * area.width + x] = marker.char;
      }
    }
  }

  // One header line per digit of the widest column number, read downwards:
  // column 23 is a 2 over a 3.
  const places = String(area.width - 1).length;
  const columns = Array.from({ length: area.width }, (_, x) =>
    String(x).padStart(places),
  );
  const header = Array.from({ length: places }, (_, place) =>
    columns.map((column) => column[place]).join(""),
  );
  const rowWidth = String(area.height - 1).length;
  const rows = Array.from(
    { length: area.height },
    (_, y) =>
      `${String(y).padStart(rowWidth)} ${cells.slice(y * area.width, (y + 1) * area.width).join("")}`,
  );
  const margin = " ".repeat(rowWidth + 1);
  const level = area.areaLevel === null ? "" : `, Area Level ${area.areaLevel}`;
  const terrain = Object.entries(TERRAIN).filter(([char]) =>
    terrainUsed.has(char),
  );
  return [
    `${area.name}: ${area.width}×${area.height}${level}`,
    "",
    ...header.map((line) => `${margin}${line}`.trimEnd()),
    ...rows,
    "",
    "Terrain",
    ...terrain.map(([char, meaning]) => `  ${char}  ${meaning}`),
    "",
    ...(markers.length === 0
      ? []
      : [
          "Markers, the first listed winning a tile two share",
          ...markers.flatMap(({ char, lines }) =>
            lines.map((line) => `  ${char}  ${line}`),
          ),
          "",
        ]),
  ].join("\n");
}

/** What the sim sees at each cell, row-major. */
function terrainOf(area: Area): string[] {
  const piece = new Map<number, "#" | "%">();
  for (const prop of area.props) {
    if (prop.blocks) piece.set(prop.y * area.width + prop.x, "%");
  }
  for (const wall of area.walls) {
    if (wall.blocks) piece.set(wall.y * area.width + wall.x, "#");
  }
  return area.floor.map((floor, i) => {
    if (area.water[i]) return "~";
    if (area.walkable[i]) return ".";
    return piece.get(i) ?? (floor ? "!" : " ");
  });
}

/** Every kind of marker the Area has, first in the legend first. */
function markersOf(area: Area): Marker[] {
  const at = (pos: Vec) => {
    const { x, y } = tileOf(pos);
    return `(${x}, ${y})`;
  };
  const markers: Marker[] = [];
  const add = (char: string, placed: [Vec, string][]) => {
    if (placed.length === 0) return;
    markers.push({
      char,
      tiles: placed.map(([pos]) => tileOf(pos)),
      lines: placed.map(([pos, line]) => `${line} at ${at(pos)}`),
    });
  };
  const unique = (name: string, monster: MonsterType) =>
    `${name} (${monsterTuning[monster].name})`;

  if (area.actBoss) {
    const { name, monster, pos } = area.actBoss;
    add("B", [[pos, `Act Boss ${unique(name, monster)}`]]);
  }
  add(
    "U",
    area.uniques.map(({ name, monster, pos }) => [
      pos,
      `Unique Monster ${unique(name, monster)}`,
    ]),
  );
  add(
    "N",
    area.npcs.map(({ name, pos }) => [pos, `NPC ${name}`]),
  );
  if (area.waypoint) add("W", [[area.waypoint, "Waypoint"]]);
  if (area.townPortal) {
    add("P", [[area.townPortal, "Town Portal's Town end"]]);
  }
  add(
    "A",
    area.boneAltars.map((pos) => [pos, "Bone Altar"]),
  );
  for (const [monster, char] of Object.entries(SPAWN_CHARS)) {
    const { name } = monsterTuning[monster as MonsterType];
    add(
      char,
      area.spawns
        .filter((spawn) => spawn.monster === monster)
        .map(({ count, pos }) => [pos, `${count} ${name}`]),
    );
  }
  add(
    "@",
    Object.entries(area.entries).map(([name, pos]) => [pos, `Entry "${name}"`]),
  );
  if (area.exits.length > 0) {
    markers.push({
      char: ">",
      tiles: area.exits.flatMap(exitTiles),
      lines: area.exits.map((exit) => {
        const tiles = exitTiles(exit);
        const { x: x0, y: y0 } = tiles[0];
        const { x: x1, y: y1 } = tiles[tiles.length - 1];
        const span = (a: number, b: number) => (a === b ? `${a}` : `${a}–${b}`);
        return `Exit to ${exit.area}, Entry "${exit.entry}", at x ${span(x0, x1)}, y ${span(y0, y1)}`;
      }),
    });
  }
  return markers;
}

/** The tiles an Exit's zone overlaps, row by row. */
function exitTiles(exit: Area["exits"][number]): Vec[] {
  const tiles: Vec[] = [];
  const x0 = Math.floor(exit.x);
  const y0 = Math.floor(exit.y);
  const x1 = Math.ceil(exit.x + exit.width) - 1;
  const y1 = Math.ceil(exit.y + exit.height) - 1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) tiles.push({ x, y });
  }
  return tiles;
}

/**
 * Each Monster type's lower-case letter, the same in every Area: the first
 * letter of its words, or failing that of its name, that no type before it
 * has taken.
 */
const SPAWN_CHARS: Record<MonsterType, string> = (() => {
  const taken = new Set<string>();
  const chars = {} as Record<MonsterType, string>;
  for (const type of Object.keys(monsterTuning) as MonsterType[]) {
    const initials = type.split("_").map((word) => word[0]);
    const char = [...initials, ...type.replaceAll("_", "")].find(
      (c) => !taken.has(c),
    );
    if (!char) throw new Error(`No letter left for Monster type "${type}"`);
    taken.add(char);
    chars[type] = char;
  }
  return chars;
})();
