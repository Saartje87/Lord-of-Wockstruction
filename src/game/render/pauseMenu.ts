import { type Fullscreen, NO_FULLSCREEN } from "../fullscreen";
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
  width: 460,
  height: 290,
  buttonsTop: 196,
  gap: 20,
};

/** Each pause-menu button's size (CSS px at native scale). */
const PAUSE_MENU_BUTTON = { width: 160, height: 32 };

/** A pause-menu button: what it picks, its label and where it is. */
export type MenuButton = { choice: MenuChoice; label: string; rect: Rect };

/**
 * Where the pause menu and its buttons are drawn: New Hero, and the
 * Fullscreen button where `fullscreen` says the browser allows it, or Yes
 * and No while `confirming` a New Hero.
 */
export function pauseMenuLayout(
  screen: Viewport,
  confirming: boolean,
  way: InputWay = "mouseAndKeyboard",
  fullscreen: Fullscreen = NO_FULLSCREEN,
): { panel: Rect; buttons: MenuButton[] } {
  const { width, height, buttonsTop, gap } = atUiScale(
    PAUSE_MENU_LAYOUT,
    screen.uiScale,
  );
  const button = atUiScale(PAUSE_MENU_BUTTON, screen.uiScale);
  const panel = {
    x: Math.round((screen.width - width) / 2),
    y: Math.round((screen.height - height) / 2),
    w: width,
    h: height,
  };
  const row = menuChoices(confirming, fullscreen).map((choice) => ({
    choice,
    label: menuChoiceLabel(choice, way, fullscreen.on),
  }));
  const rowWidth = row.length * button.width + (row.length - 1) * gap;
  const left = panel.x + (panel.w - rowWidth) / 2;
  return {
    panel,
    buttons: row.map((entry, i) => ({
      ...entry,
      rect: {
        x: left + i * (button.width + gap),
        y: panel.y + buttonsTop,
        w: button.width,
        h: button.height,
      },
    })),
  };
}

/**
 * The pause-menu button under `point`, or null off them all; the
 * Fullscreen button only where `fullscreen` says the browser allows it.
 */
export function menuChoiceAt(
  screen: Viewport,
  point: Vec,
  confirming: boolean,
  fullscreen: Fullscreen = NO_FULLSCREEN,
): MenuChoice | null {
  const { buttons } = pauseMenuLayout(
    screen,
    confirming,
    undefined,
    fullscreen,
  );
  return buttons.find((button) => inside(button.rect, point))?.choice ?? null;
}
