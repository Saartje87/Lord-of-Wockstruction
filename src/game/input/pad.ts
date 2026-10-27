import type { Vec } from "../sim/vec";
import type { Order } from "../sim/world";
import { inputTuning } from "../tuning/input";

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

/** Pad state between frames. Walking needs none: each snapshot says it all. */
export type PadInput = Record<never, never>;

/** How the pad sees the screen, as last drawn. */
export type PadView = {
  /** Maps a canvas point (CSS px) to tile units. */
  toTile(screen: Vec): Vec;
};

export function createPadInput(): PadInput {
  return {};
}

/**
 * Called once per frame, as `poll` is for the pointer. Returns the orders
 * for the sim: a walk in the direction the stick points on screen, in tiles,
 * for as long as it is pushed past the dead zone; nothing once let go, which
 * stops the Hero.
 */
export function pollPad(
  _input: PadInput,
  snapshot: PadSnapshot,
  _nowMs: number,
  view: PadView,
): { orders: Order[] } {
  const { stick } = snapshot;
  if (Math.hypot(stick.x, stick.y) <= inputTuning.stickDeadZone) {
    return { orders: [] };
  }
  // The view maps points; the direction is between two of them.
  const from = view.toTile({ x: 0, y: 0 });
  const to = view.toTile(stick);
  const direction = { x: to.x - from.x, y: to.y - from.y };
  return { orders: [{ type: "Walk", direction }] };
}
