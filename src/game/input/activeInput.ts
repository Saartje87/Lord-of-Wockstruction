import { inputTuning } from "../tuning/input";
import type { PadSnapshot } from "./pad";

/** A way to play: mouse and keyboard, a controller, or touch. */
export type InputWay = "mouseAndKeyboard" | "controller" | "touch";

/** The Active Input: the way the player last played. */
export type ActiveInput = { way: InputWay };

/**
 * What an input event tells the Active Input: that a way was used, or that
 * a controller was plugged in or out.
 */
export type InputEvent =
  | { type: "used"; way: InputWay }
  | { type: "controllerConnected" }
  | { type: "controllerDisconnected" };

/**
 * Touch on a device whose main pointer is a finger (`coarsePointer`), else
 * mouse and keyboard, until the player uses another way.
 */
export function createActiveInput(coarsePointer: boolean): ActiveInput {
  return { way: coarsePointer ? "touch" : "mouseAndKeyboard" };
}

/**
 * Tells the Active Input of `event`: a way used becomes it, and plugging a
 * controller in or out changes nothing. Returns whether to open the pause
 * menu, which a controller disconnecting while it is the Active Input does.
 */
export function reportInput(
  active: ActiveInput,
  event: InputEvent,
): { pause: boolean } {
  if (event.type === "used") active.way = event.way;
  return {
    pause:
      event.type === "controllerDisconnected" && active.way === "controller",
  };
}

/**
 * The way a pointer of `PointerEvent.pointerType` plays: touch for a
 * finger, mouse and keyboard for a mouse or a pen.
 */
export function pointerWay(pointerType: string): InputWay {
  return pointerType === "touch" ? "touch" : "mouseAndKeyboard";
}

/**
 * Whether the player used the pad this frame: a button pressed, or the
 * stick pushed past its dead zone. A worn stick resting inside it is not.
 */
export function padTouched(snapshot: PadSnapshot): boolean {
  return (
    snapshot.pressed.length > 0 ||
    Math.hypot(snapshot.stick.x, snapshot.stick.y) > inputTuning.stickDeadZone
  );
}
