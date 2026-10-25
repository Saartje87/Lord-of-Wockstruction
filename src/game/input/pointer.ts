import { tileOf, type Vec } from "../sim/vec";
import type { Order } from "../sim/world";
import { inputTuning } from "../tuning/input";

/** Mouse state between frames. */
export type PointerInput = {
  /** Where the cursor is on the canvas (CSS px), or null when off it. */
  screen: Vec | null;
  /**
   * Where the button went down since the last poll, even if it has been
   * released and the pointer has left again since.
   */
  pressedAt: Vec | null;
  held: boolean;
  /** When the last `MoveTo` went out. */
  lastOrderMs: number;
};

export function createPointerInput(): PointerInput {
  return { screen: null, pressedAt: null, held: false, lastOrderMs: 0 };
}

/** Feeds the canvas's pointer events into `input` until `signal` aborts. */
export function attachPointer(
  canvas: HTMLCanvasElement,
  input: PointerInput,
  signal: AbortSignal,
) {
  const on = <K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (e: HTMLElementEventMap[K]) => void,
  ) => canvas.addEventListener(type, listener, { signal });

  on("pointerdown", (e) => {
    if (e.button !== 0) return;
    // Keep receiving moves and the release while held outside the canvas.
    canvas.setPointerCapture(e.pointerId);
    press(input, { x: e.offsetX, y: e.offsetY });
  });
  on("pointerup", (e) => {
    if (e.button === 0) release(input);
  });
  on("pointercancel", () => release(input));
  on("lostpointercapture", () => release(input));
  on("pointermove", (e) => move(input, { x: e.offsetX, y: e.offsetY }));
  on("pointerleave", () => move(input, null));
}

export function press(input: PointerInput, screen: Vec) {
  input.screen = screen;
  input.pressedAt = screen;
  input.held = true;
}

/** The cursor moved on the canvas, or left it (null). */
export function move(input: PointerInput, screen: Vec | null) {
  input.screen = screen;
}

export function release(input: PointerInput) {
  input.held = false;
}

/**
 * Called once per frame, with how to map a canvas point (CSS px) to tile
 * units. Returns the orders for the sim, and the target of a fresh click, if
 * any, to mark.
 */
export function poll(
  input: PointerInput,
  nowMs: number,
  toTile: (screen: Vec) => Vec,
): { orders: Order[]; click: Vec | null } {
  const { pressedAt } = input;
  input.pressedAt = null;
  const retarget =
    input.held && nowMs - input.lastOrderMs >= inputTuning.retargetMs;
  const at = pressedAt ?? (retarget ? input.screen : null);
  if (!at) return { orders: [], click: null };

  input.lastOrderMs = nowMs;
  const target = tileCentre(toTile(at));
  return {
    orders: [{ type: "MoveTo", target }],
    click: pressedAt ? target : null,
  };
}

function tileCentre(point: Vec): Vec {
  const tile = tileOf(point);
  return { x: tile.x + 0.5, y: tile.y + 0.5 };
}
