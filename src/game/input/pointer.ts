import { tileOf, type Vec } from "../sim/vec";
import type { MonsterId, Order } from "../sim/world";
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
  /** Whether Shift was down when the button went down. */
  shift: boolean;
  held: boolean;
  /** What holding the button keeps doing, decided when it went down. */
  holding: Holding;
  /** When the last order went out. */
  lastOrderMs: number;
};

type Holding =
  | { type: "steer" }
  /** Held from a press on a panel, which orders nothing. */
  | { type: "panel" }
  | { type: "attack"; monster: MonsterId }
  | { type: "swing" };

/** How input sees the screen, as last drawn. */
export type PointerView = {
  /** Maps a canvas point (CSS px) to tile units. */
  toTile(screen: Vec): Vec;
  /** The Monster drawn under a canvas point (CSS px), if any. */
  monsterAt(screen: Vec): MonsterId | null;
  /** Whether a canvas point (CSS px) is on a panel or button over the World. */
  onPanel(screen: Vec): boolean;
};

export function createPointerInput(): PointerInput {
  return {
    screen: null,
    pressedAt: null,
    shift: false,
    held: false,
    holding: { type: "steer" },
    lastOrderMs: 0,
  };
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
    press(input, { x: e.offsetX, y: e.offsetY }, { shift: e.shiftKey });
  });
  on("pointerup", (e) => {
    if (e.button === 0) release(input);
  });
  on("pointercancel", () => release(input));
  on("lostpointercapture", () => release(input));
  on("pointermove", (e) => move(input, { x: e.offsetX, y: e.offsetY }));
  on("pointerleave", () => move(input, null));
}

export function press(
  input: PointerInput,
  screen: Vec,
  { shift = false }: { shift?: boolean } = {},
) {
  input.screen = screen;
  input.pressedAt = screen;
  input.shift = shift;
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
 * Forgets the button: a press not yet polled orders nothing, and holding on
 * keeps doing nothing until the next press.
 */
export function cancel(input: PointerInput) {
  input.pressedAt = null;
  release(input);
}

/**
 * Called once per frame. Returns the orders for the sim, the target of a
 * fresh click on the floor, if any, to mark, and where a fresh click on a
 * panel was, if any, for the panel to handle.
 *
 * A click attacks the Monster under it, or walks; Shift + click swings in
 * place. Holding the button repeats that every `retargetMs` towards the
 * cursor, keeps attacking the same Monster, and switches from walking to
 * attacking as soon as the cursor passes over a Monster. A click on a panel
 * orders nothing, nor does holding it on, and steering doesn't follow the
 * cursor onto a panel.
 */
export function poll(
  input: PointerInput,
  nowMs: number,
  view: PointerView,
): { orders: Order[]; click: Vec | null; panel: Vec | null } {
  const none = { orders: [], click: null, panel: null };
  const { pressedAt } = input;
  input.pressedAt = null;
  if (pressedAt) {
    input.lastOrderMs = nowMs;
    if (view.onPanel(pressedAt)) {
      input.holding = { type: "panel" };
      return { ...none, panel: pressedAt };
    }
    const monster = view.monsterAt(pressedAt);
    if (input.shift) {
      input.holding = { type: "swing" };
    } else if (monster !== null) {
      input.holding = { type: "attack", monster };
    } else {
      input.holding = { type: "steer" };
      const target = tileCentre(view.toTile(pressedAt));
      return { ...none, orders: [{ type: "MoveTo", target }], click: target };
    }
    return { ...none, orders: [holdOrder(input.holding, view, pressedAt)] };
  }

  if (!input.held || !input.screen) return none;
  if (input.holding.type === "panel") return none;
  if (input.holding.type === "steer" && view.onPanel(input.screen)) {
    return none;
  }
  // Checked every frame, so a quick pass over a Monster isn't missed.
  const passed =
    input.holding.type === "steer" ? view.monsterAt(input.screen) : null;
  if (passed !== null) {
    input.holding = { type: "attack", monster: passed };
  } else if (nowMs - input.lastOrderMs < inputTuning.retargetMs) {
    return none;
  }
  input.lastOrderMs = nowMs;
  const order = holdOrder(input.holding, view, input.screen);
  return { ...none, orders: [order] };
}

/** The order that holding the button gives with the cursor at `screen`. */
function holdOrder(
  holding: Exclude<Holding, { type: "panel" }>,
  view: PointerView,
  screen: Vec,
): Order {
  switch (holding.type) {
    case "steer":
      return { type: "MoveTo", target: tileCentre(view.toTile(screen)) };
    case "attack":
      return { type: "Attack", monster: holding.monster };
    case "swing":
      return { type: "SwingAt", target: view.toTile(screen) };
  }
}

function tileCentre(point: Vec): Vec {
  const tile = tileOf(point);
  return { x: tile.x + 0.5, y: tile.y + 0.5 };
}
