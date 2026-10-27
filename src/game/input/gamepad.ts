import { type PadButton, type PadSnapshot, restingPad } from "./pad";

/** The pad buttons by their index in the Gamepad API's standard mapping. */
const STANDARD_BUTTONS: readonly (PadButton | null)[] = [
  "a",
  "b",
  "x",
  "y",
  "lb",
  "rb",
  "lt",
  "rt",
  "view",
  "menu",
  // The stick buttons are unused.
  null,
  null,
  "up",
  "down",
  "left",
  "right",
];

/**
 * Reads the first connected controller with the standard mapping into a
 * snapshot, given the buttons `previous` held last frame; a resting pad when
 * there is none. Untested glue, like `attachPointer`.
 */
export function readGamepad(previous: readonly PadButton[]): PadSnapshot {
  const gamepads =
    typeof navigator !== "undefined" && navigator.getGamepads
      ? navigator.getGamepads()
      : [];
  const pad = gamepads.find(
    (gamepad) => gamepad?.connected && gamepad.mapping === "standard",
  );
  if (!pad) return { ...restingPad, released: [...previous] };
  const held = STANDARD_BUTTONS.filter(
    (button, i): button is PadButton =>
      button !== null && pad.buttons[i]?.pressed === true,
  );
  return {
    stick: { x: pad.axes[0] ?? 0, y: pad.axes[1] ?? 0 },
    pressed: held.filter((button) => !previous.includes(button)),
    held,
    released: previous.filter((button) => !held.includes(button)),
  };
}
