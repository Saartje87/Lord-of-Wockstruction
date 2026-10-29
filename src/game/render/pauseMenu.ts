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
  width: 460,
  height: 340,
  buttonsTop: 196,
  gap: 20,
};

/**
 * The "3D World (beta)" button's width (CSS px at native scale): wider than
 * the others, for its longer label, on a row of its own under them.
 */
export const WORLD_3D_BUTTON_WIDTH = 240;

/**
 * A menu button's size (CSS px at native scale): each of the pause menu's,
 * and the Rotate Notice's Fullscreen button.
 */
export const MENU_BUTTON = { width: 160, height: 32 };

/** A pause-menu button: what it picks, its label and where it is. */
export type MenuButton = { choice: MenuChoice; label: string; rect: Rect };

/**
 * Where the pause menu and its buttons are drawn: New Hero, and the
 * Fullscreen button where `fullscreen` says the browser allows it, with
 * the 3D World (beta) button, reading as `world3d` says, under them; or Yes
 * and No while `confirming` a New Hero.
 */
export function pauseMenuLayout(
  screen: Viewport,
  confirming: boolean,
  way: InputWay,
  fullscreen: Fullscreen,
  world3d: boolean,
): { panel: Rect; buttons: MenuButton[] } {
  const { width, height, buttonsTop, gap } = atUiScale(
    PAUSE_MENU_LAYOUT,
    screen.uiScale,
  );
  const button = atUiScale(MENU_BUTTON, screen.uiScale);
  const panel = {
    x: Math.round((screen.width - width) / 2),
    y: Math.round((screen.height - height) / 2),
    w: width,
    h: height,
  };
  const choices = menuChoices(confirming, fullscreen);
  const labelled = (choice: MenuChoice) => ({
    choice,
    label: menuChoiceLabel(choice, way, fullscreen.on, world3d),
  });
  // The 3D World (beta) button stands apart, on a row under the others.
  const row = choices.filter((choice) => choice !== "world3d").map(labelled);
  const rowWidth = row.length * button.width + (row.length - 1) * gap;
  const left = panel.x + (panel.w - rowWidth) / 2;
  const buttons = row.map((entry, i) => ({
    ...entry,
    rect: {
      x: left + i * (button.width + gap),
      y: panel.y + buttonsTop,
      w: button.width,
      h: button.height,
    },
  }));
  if (choices.includes("world3d")) {
    const width = atUiScale(
      { width: WORLD_3D_BUTTON_WIDTH },
      screen.uiScale,
    ).width;
    buttons.push({
      ...labelled("world3d"),
      rect: {
        x: panel.x + (panel.w - width) / 2,
        y: panel.y + buttonsTop + button.height + gap,
        w: width,
        h: button.height,
      },
    });
  }
  return { panel, buttons };
}

/**
 * The pause-menu button under `point`, as laid out with the Active Input
 * `way`, or null off them all; the Fullscreen button only where
 * `fullscreen` says the browser allows it.
 */
export function menuChoiceAt(
  screen: Viewport,
  point: Vec,
  confirming: boolean,
  way: InputWay,
  fullscreen: Fullscreen,
  world3d: boolean,
): MenuChoice | null {
  const { buttons } = pauseMenuLayout(
    screen,
    confirming,
    way,
    fullscreen,
    world3d,
  );
  return buttons.find((button) => inside(button.rect, point))?.choice ?? null;
}
