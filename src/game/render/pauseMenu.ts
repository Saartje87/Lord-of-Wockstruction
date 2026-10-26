import type { MenuChoice } from "../menus";
import { inside, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import type { Viewport } from "../viewport";

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
  button: { width: 160, height: 32 },
  gap: 20,
};

/** A pause-menu button: what it picks, its label and where it is. */
export type MenuButton = { choice: MenuChoice; label: string; rect: Rect };

/**
 * Where the pause menu and its buttons are drawn: New Hero, or Yes and No
 * while `confirming` one.
 */
export function pauseMenuLayout(
  screen: Viewport,
  confirming: boolean,
): { panel: Rect; buttons: MenuButton[] } {
  const scale = screen.uiScale;
  const { width, height, buttonsTop, gap } = PAUSE_MENU_LAYOUT;
  const button = {
    width: PAUSE_MENU_LAYOUT.button.width * scale,
    height: PAUSE_MENU_LAYOUT.button.height * scale,
  };
  const panel = {
    x: Math.round((screen.width - width * scale) / 2),
    y: Math.round((screen.height - height * scale) / 2),
    w: width * scale,
    h: height * scale,
  };
  const row: { choice: MenuChoice; label: string }[] = confirming
    ? [
        { choice: "confirm", label: "Yes (Y)" },
        { choice: "goBack", label: "No (N)" },
      ]
    : [{ choice: "newHero", label: "New Hero (N)" }];
  const rowWidth = row.length * button.width + (row.length - 1) * gap * scale;
  const left = panel.x + (panel.w - rowWidth) / 2;
  return {
    panel,
    buttons: row.map((entry, i) => ({
      ...entry,
      rect: {
        x: left + i * (button.width + gap * scale),
        y: panel.y + buttonsTop * scale,
        w: button.width,
        h: button.height,
      },
    })),
  };
}

/** The pause-menu button under `point`, or null off them all. */
export function menuChoiceAt(
  screen: Viewport,
  point: Vec,
  confirming: boolean,
): MenuChoice | null {
  const { buttons } = pauseMenuLayout(screen, confirming);
  return buttons.find((button) => inside(button.rect, point))?.choice ?? null;
}
