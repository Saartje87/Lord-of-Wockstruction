import type { ItemId } from "../sim/inventory";
import { distance, type Vec } from "../sim/vec";
import type { MonsterId, Order, World } from "../sim/world";
import { inputTuning } from "../tuning/input";
import { pickTarget } from "./target";

/**
 * A pad button, named as on an Xbox-style controller: the face buttons, the
 * bumpers and triggers, View and Menu, and the D-pad's four directions. The
 * touch controls stand in for the same buttons.
 */
export type PadButton =
  | "a"
  | "b"
  | "x"
  | "y"
  | "lb"
  | "rb"
  | "lt"
  | "rt"
  | "view"
  | "menu"
  | "up"
  | "down"
  | "left"
  | "right";

/**
 * The pad as read this frame, whatever device it comes from: the stick's
 * direction on screen (x right, y down, of length up to 1) and the buttons
 * that went down since the last frame, are down now, and went up since.
 */
export type PadSnapshot = {
  stick: Vec;
  pressed: readonly PadButton[];
  held: readonly PadButton[];
  released: readonly PadButton[];
};

/** A snapshot of a pad left alone: the stick at rest, no button down. */
export const restingPad: PadSnapshot = {
  stick: { x: 0, y: 0 },
  pressed: [],
  held: [],
  released: [],
};

/** Pad state between frames: when A, held, last ordered. */
export type PadInput = {
  /** When A last ordered while held (ms), or null when it isn't held. */
  lastOrderMs: number | null;
};

/** How the pad sees the screen, as last drawn, and the World, as last stepped. */
export type PadView = {
  /** Maps a canvas point (CSS px) to tile units. */
  toTile(screen: Vec): Vec;
  /** The World as last stepped, which auto-aim picks the Target from. */
  world: World;
};

export function createPadInput(): PadInput {
  return { lastOrderMs: null };
}

/**
 * Called once per frame, as `poll` is for the pointer. Returns the orders
 * for the sim and the Target, for the renderer to show.
 *
 * The stick walks the Hero in the direction it points on screen, in tiles,
 * for as long as it is pushed past the dead zone; nothing once let go, which
 * stops the Hero. The Target is picked ahead of the stick while pushed,
 * otherwise ahead of the Hero's facing. A attacks the Target; with none it
 * picks up the nearest Ground Item within `groundItemReach`; with neither it
 * does nothing. Held, A acts again every `retargetMs`, picking the Target
 * afresh, and while it has something to act on, the stick aims rather than
 * walks.
 */
export function pollPad(
  input: PadInput,
  snapshot: PadSnapshot,
  nowMs: number,
  view: PadView,
): { orders: Order[]; target: MonsterId | null } {
  const { world } = view;
  const walk = walkDirection(snapshot.stick, view);
  const facing = {
    x: Math.cos(world.hero.facing),
    y: Math.sin(world.hero.facing),
  };
  const target = pickTarget(world, walk ?? facing);
  const action = target !== null ? attack(target) : pickUpNear(world);
  const orders: Order[] = [];
  if (!snapshot.held.includes("a")) {
    input.lastOrderMs = null;
  } else if (
    snapshot.pressed.includes("a") ||
    input.lastOrderMs === null ||
    nowMs - input.lastOrderMs >= inputTuning.retargetMs
  ) {
    input.lastOrderMs = nowMs;
    if (action) orders.push(action);
  }
  const aiming = snapshot.held.includes("a") && action !== null;
  if (walk && !aiming) orders.push({ type: "Walk", direction: walk });
  return { orders, target };
}

/**
 * The direction in tiles the stick walks the Hero, or null when it rests
 * inside the dead zone.
 */
function walkDirection(stick: Vec, view: PadView): Vec | null {
  if (Math.hypot(stick.x, stick.y) <= inputTuning.stickDeadZone) return null;
  // The view maps points; the direction is between two of them.
  const from = view.toTile({ x: 0, y: 0 });
  const to = view.toTile(stick);
  return { x: to.x - from.x, y: to.y - from.y };
}

const attack = (monster: MonsterId): Order => ({ type: "Attack", monster });

/** A pick-up of the nearest Ground Item within reach of the Hero, if any. */
function pickUpNear(world: World): Order | null {
  let nearest: { id: ItemId; away: number } | null = null;
  for (const { item, pos } of world.groundItems) {
    const away = distance(world.hero.pos, pos);
    if (away > inputTuning.groundItemReach) continue;
    if (nearest && away >= nearest.away) continue;
    nearest = { id: item.id, away };
  }
  return nearest && { type: "PickUp", groundItem: nearest.id };
}
