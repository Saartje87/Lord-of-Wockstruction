import type { Placed } from "../sim/area";

/**
 * A piece of a Wall: which of the Area's Walls it is part of, what model
 * draws it, and how far it is turned.
 */
export type WallPlacement = {
  /** Index into the Area's `walls`. */
  wall: number;
  /** The model's piece name. */
  piece: string;
  /**
   * Quarter turns about the vertical axis, in the direction that takes
   * tile -x to +y to +x to -y.
   */
  turn: number;
};

/**
 * The pieces that join up a straight Wall: KayKit's dungeon Wall has corner,
 * T and crossing pieces. Other Wall pieces (the Town's fence) have none.
 */
const JOINTS: Record<
  string,
  { corner: string; tee: string; cross: string } | undefined
> = {
  "dungeon/wall": {
    corner: "dungeon/wall_corner",
    tee: "dungeon/wall_Tsplit",
    cross: "dungeon/wall_crossing",
  },
};

/** The sides of a cell in the order a quarter turn moves an arm: W, S, E, N. */
const SIDES = [
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
];

/**
 * How each Wall of an Area is drawn, from its Wall neighbours: a straight
 * run along x or y, and a corner, T or crossing piece where runs meet. A
 * Wall piece with no joints is drawn as a straight piece along each axis
 * it has neighbours on.
 *
 * The corner piece joins west and south, the T joins west, east and south,
 * both turned 0; the crossing joins all four.
 */
export function wallPlacementsOf(walls: Placed[]): WallPlacement[] {
  const at = new Set(walls.map(({ x, y }) => `${x},${y}`));
  const placements: WallPlacement[] = [];
  walls.forEach((wall, index) => {
    // Neighbours as W, S, E, N.
    const arms = SIDES.map(({ dx, dy }) =>
      at.has(`${wall.x + dx},${wall.y + dy}`),
    );
    const [west, south, east, north] = arms;
    const count = arms.filter(Boolean).length;
    const joints = JOINTS[wall.piece];
    const place = (piece: string, turn: number) => {
      placements.push({ wall: index, piece, turn });
    };
    const alongX = west || east;
    const alongY = south || north;

    if (joints && count === 4) {
      place(joints.cross, 0);
    } else if (joints && count === 3) {
      // The missing side is north when turned 0, and moves on per turn.
      place(joints.tee, (arms.indexOf(false) + 1) % 4);
    } else if (joints && count === 2 && !(west && east) && !(south && north)) {
      // The first of the two arms, in turn order, that is followed by the
      // other is the corner's west arm.
      place(
        joints.corner,
        arms.findIndex((arm, i) => arm && arms[(i + 1) % 4]),
      );
    } else if (joints) {
      // Straight: along y only when there is nothing along x.
      place(wall.piece, alongY && !alongX ? 1 : 0);
    } else {
      if (alongX || !alongY) place(wall.piece, 0);
      if (alongY) place(wall.piece, 1);
    }
  });
  return placements;
}
