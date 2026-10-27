import type { TouchControlsLayout } from "../render/touchControls";
import { inside } from "../sim/rect";
import { SKILL_BAR_SLOTS } from "../sim/skillBar";
import type { Vec } from "../sim/vec";
import { castButton, type PadButton, type PadSnapshot } from "./pad";

/** What one finger holds of the touch controls. */
type TouchHold = (
  | { type: "stick"; from: Vec; at: Vec; reach: number }
  | { type: "button"; button: PadButton }
) & {
  /** Whether a frame has read it yet, so a quick tap still counts. */
  read: boolean;
  /** Whether the finger has lifted, to be forgotten once read. */
  lifted: boolean;
};

/**
 * The touch controls as the fingers hold them, by pointer id, and the pad
 * buttons they held as last read.
 */
export type TouchControls = {
  holds: Map<number, TouchHold>;
  lastHeld: readonly PadButton[];
};

/** Touch controls no finger holds yet. */
export function createTouchControls(): TouchControls {
  return { holds: new Map(), lastHeld: [] };
}

/**
 * A finger `id` coming down at `at` (CSS px): in the Virtual Stick zone it
 * starts the stick there; on the attack button it holds A; on a Skill
 * button, that slot's controller button; on the pause button or its touch
 * hit area, Menu, the only one taken while a panel is open (`pauseOnly`).
 * Returns whether the
 * touch controls take it; one they don't is for the pointer.
 */
export function touchDown(
  controls: TouchControls,
  id: number,
  at: Vec,
  layout: TouchControlsLayout,
): boolean {
  const button = buttonAt(layout, at);
  if (button) {
    controls.holds.set(id, {
      type: "button",
      button,
      read: false,
      lifted: false,
    });
    return true;
  }
  if (layout.pauseOnly || !inside(layout.stickZone, at)) return false;
  // One Virtual Stick: a second thumb in its zone takes it over.
  for (const [other, hold] of controls.holds) {
    if (hold.type === "stick") controls.holds.delete(other);
  }
  controls.holds.set(id, {
    type: "stick",
    from: { ...at },
    at: { ...at },
    reach: layout.stick.reach,
    read: false,
    lifted: false,
  });
  return true;
}

/** Finger `id` moved to `at`: the Virtual Stick follows its own finger. */
export function touchMove(controls: TouchControls, id: number, at: Vec) {
  const hold = controls.holds.get(id);
  if (hold?.type === "stick" && !hold.lifted) hold.at = { ...at };
}

/** Finger `id` lifted, or the browser took it away. */
export function touchUp(controls: TouchControls, id: number) {
  const hold = controls.holds.get(id);
  if (!hold) return;
  if (hold.read) controls.holds.delete(id);
  else hold.lifted = true;
}

/**
 * The touch controls read as a pad snapshot, once a frame: the Virtual
 * Stick's push from where it landed (full at its reach) and the buttons
 * held. A tap lifted before any frame read it still counts as held for one
 * frame, so it acts.
 */
export function readTouch(controls: TouchControls): PadSnapshot {
  const holds = [...controls.holds.values()];
  const buttonsOf = (from: TouchHold[]) => [
    ...new Set(
      from.flatMap((hold) => (hold.type === "button" ? [hold.button] : [])),
    ),
  ];
  const held = buttonsOf(holds);
  const pressed = buttonsOf(holds.filter((hold) => !hold.read)).filter(
    (button) => !controls.lastHeld.includes(button),
  );
  const released = controls.lastHeld.filter((button) => !held.includes(button));
  const stickHold = holds.find((hold) => hold.type === "stick" && !hold.lifted);
  const stick = stickHold?.type === "stick" ? push(stickHold) : { x: 0, y: 0 };
  for (const [id, hold] of controls.holds) {
    if (hold.lifted) controls.holds.delete(id);
    hold.read = true;
  }
  controls.lastHeld = held;
  return { stick, pressed, held, released };
}

/**
 * Where the Virtual Stick held by a finger stands, for drawing: where it
 * landed and where the finger is now; null while no finger holds it.
 */
export function stickHeld(
  controls: TouchControls,
): { from: Vec; at: Vec } | null {
  for (const hold of controls.holds.values()) {
    if (hold.type === "stick" && !hold.lifted) {
      return { from: hold.from, at: hold.at };
    }
  }
  return null;
}

/** The pad buttons the fingers hold now, for drawing them pressed in. */
export function buttonsHeld(controls: TouchControls): PadButton[] {
  return [...controls.holds.values()].flatMap((hold) =>
    hold.type === "button" && !hold.lifted ? [hold.button] : [],
  );
}

/**
 * Feeds the canvas's touches into `controls` until `signal` aborts. A touch
 * coming down where `layoutAt` gives the touch controls, and that they take,
 * is theirs from then on: none of its events reach the canvas's other
 * listeners, so the pointer never sees it. Untested glue, like
 * `attachPointer`.
 */
export function attachTouch(
  canvas: HTMLCanvasElement,
  controls: TouchControls,
  layoutAt: (at: Vec) => TouchControlsLayout | null,
  signal: AbortSignal,
) {
  /** The pointer ids the touch controls took; ids aren't reused soon. */
  const taken = new Set<number>();
  // On the window as it captures, so before any listener on the canvas.
  const on = (
    type:
      | "pointerdown"
      | "pointermove"
      | "pointerup"
      | "pointercancel"
      | "lostpointercapture"
      | "pointerleave",
    listener: (e: PointerEvent) => void,
  ) => window.addEventListener(type, listener, { capture: true, signal });
  const ours = (e: PointerEvent) => {
    if (!taken.has(e.pointerId)) return false;
    e.stopImmediatePropagation();
    return true;
  };

  on("pointerdown", (e) => {
    if (e.target !== canvas) return;
    taken.delete(e.pointerId);
    if (e.pointerType !== "touch") return;
    const at = { x: e.offsetX, y: e.offsetY };
    const layout = layoutAt(at);
    if (!layout || !touchDown(controls, e.pointerId, at, layout)) return;
    taken.add(e.pointerId);
    e.stopImmediatePropagation();
  });
  on("pointermove", (e) => {
    if (ours(e))
      touchMove(controls, e.pointerId, { x: e.offsetX, y: e.offsetY });
  });
  for (const type of ["pointerup", "pointercancel"] as const) {
    on(type, (e) => {
      if (ours(e)) touchUp(controls, e.pointerId);
    });
  }
  // The browser's own capture and leave events of a taken touch aren't the
  // pointer's either; they don't bubble, but are still captured.
  for (const type of ["lostpointercapture", "pointerleave"] as const) {
    on(type, ours);
  }
}

/** The pad button of the touch button at `at`, if any. */
function buttonAt(layout: TouchControlsLayout, at: Vec): PadButton | null {
  if (inside(layout.pauseHit, at)) return "menu";
  if (layout.pauseOnly) return null;
  if (inside(layout.attack, at)) return "a";
  const slot = SKILL_BAR_SLOTS.find((slot) => inside(layout.skills[slot], at));
  return slot ? castButton(slot) : null;
}

/** The stick's push: the finger's way from where it landed, over its reach. */
function push({ from, at, reach }: { from: Vec; at: Vec; reach: number }) {
  const x = (at.x - from.x) / reach;
  const y = (at.y - from.y) / reach;
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}
