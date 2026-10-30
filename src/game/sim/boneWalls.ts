import { tileOf, type Vec } from "./vec";

/**
 * One piece of a Bone Wall: a bone Prop with Life on one tile that blocks
 * walking for everyone while it stands, and stops a Monster's Projectile.
 * Leaving the Area takes the Wall down.
 */
export type BoneWallPiece = {
  /** Its tile's index in the Area's row-major grids: one piece to a tile. */
  id: number;
  /** The middle of its tile. */
  pos: Vec;
  life: number;
  /** Steps left before it crumbles on its own. */
  left: number;
};

/** How far from a piece's middle a Monster's Projectile is stopped (tiles). */
export const BONE_WALL_REACH = 0.6;

/** How far a piece's middle is from its edge, along an axis (tiles). */
export const BONE_WALL_HALF = 0.5;

/** How finely the line of a Wall is sampled, so no tile on it is missed. */
const SAMPLE = 0.25;

/**
 * The tiles' middles of a Wall of `length` tiles centred on `target`,
 * across the way from `from` to `target` (across `facing` when they
 * coincide), in order along the line.
 */
export function wallSpots(
  from: Vec,
  target: Vec,
  facing: number,
  length: number,
): Vec[] {
  let dx = target.x - from.x;
  let dy = target.y - from.y;
  const apart = Math.hypot(dx, dy);
  if (apart === 0) {
    dx = Math.cos(facing);
    dy = Math.sin(facing);
  } else {
    dx /= apart;
    dy /= apart;
  }
  const across = { x: -dy, y: dx };
  const spots: Vec[] = [];
  for (let t = -length / 2 + SAMPLE / 2; t < length / 2; t += SAMPLE) {
    const tile = tileOf({
      x: target.x + across.x * t,
      y: target.y + across.y * t,
    });
    const spot = { x: tile.x + 0.5, y: tile.y + 0.5 };
    if (!spots.some((one) => one.x === spot.x && one.y === spot.y)) {
      spots.push(spot);
    }
  }
  return spots;
}
