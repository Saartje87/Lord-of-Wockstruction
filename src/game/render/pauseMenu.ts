import type { Fullscreen } from "../fullscreen";
import type { InputWay } from "../input/activeInput";
import { type MenuChoice, menuChoices } from "../menus";
import { inside, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import { atUiScale, type Viewport } from "../viewport";
import { menuChoiceLabel } from "./hints";

/**
 * Where the pause menu goes (CSS px at native scale, drawn at the UI
 * Scale): a `width` × `height` panel in the
 * middle of the screen, with its buttons in a row `buttonsTop` down it,
 * `gap` apart.
 */
export const PAUSE_MENU_LAYOUT = {
  width: 500,
  height: 290,
  buttonsTop: 196,
  gap: 20,
};

/**
 * A menu button's size (CSS px at native scale): each of the pause menu's,
 * and the Rotate Notice's Fullscreen button.
 */
export const MENU_BUTTON = { width: 210, height: 32 };

/** A pause-menu button: what it picks, its label and where it is. */
export type MenuButton = { choice: MenuChoice; label: string; rect: Rect };

/**
 * Where the pause menu and its buttons are drawn: Quit to Start Screen, and
 * the Fullscreen button where `fullscreen` says the browser allows it.
 */
export function pauseMenuLayout(
  screen: Viewport,
  way: InputWay,
  fullscreen: Fullscreen,
): { panel: Rect; buttons: MenuButton[] } {
  const { width, height, buttonsTop, gap } = atUiScale(
    PAUSE_MENU_LAYOUT,
    screen.uiScale,
  );
  const panel = {
    x: Math.round((screen.width - width) / 2),
    y: Math.round((screen.height - height) / 2),
    w: width,
    h: height,
  };
  const row = menuChoices(fullscreen).map((choice) => ({
    choice,
    label: menuChoiceLabel(choice, way, fullscreen.on),
  }));
  const buttons = buttonRow(row, {
    centre: panel.x + panel.w / 2,
    top: panel.y + buttonsTop,
    gap,
    uiScale: screen.uiScale,
  });
  return { panel, buttons };
}

/**
 * Lays out `row` of buttons left to right, `gap` apart, centred on `centre`
 * with their tops at `top` (CSS px), each as big as `MENU_BUTTON` at the UI
 * Scale: the pause menu's row and the Start Screen's.
 */
export function buttonRow(
  row: readonly { choice: MenuChoice; label: string }[],
  place: { centre: number; top: number; gap: number; uiScale: number },
): MenuButton[] {
  const { centre, top, gap, uiScale } = place;
  const button = atUiScale(MENU_BUTTON, uiScale);
  const rowWidth = row.length * button.width + (row.length - 1) * gap;
  const left = centre - rowWidth / 2;
  return row.map((entry, i) => ({
    ...entry,
    rect: {
      x: left + i * (button.width + gap),
      y: top,
      w: button.width,
      h: button.height,
    },
  }));
}

/**
 * The pause-menu button under `point`, as laid out with the Active Input
 * `way`, or null off them all; the Fullscreen button only where
 * `fullscreen` says the browser allows it.
 */
export function menuChoiceAt(
  screen: Viewport,
  point: Vec,
  way: InputWay,
  fullscreen: Fullscreen,
): MenuChoice | null {
  const { buttons } = pauseMenuLayout(screen, way, fullscreen);
  return buttons.find((button) => inside(button.rect, point))?.choice ?? null;
}
